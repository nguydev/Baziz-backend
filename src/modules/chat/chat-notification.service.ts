/**
 * Chat Push Notifications — FCM with debounce + mute respect
 */

import { GoogleAuth } from 'google-auth-library';
import logger from '../../config/logger';
import { ensureRedisReady, getRedisClient } from '../../config/redis';
import DeviceToken from '../rent-payment/device-token.model';
import User from '../user/user.model';

const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
const DEBOUNCE_SECONDS = 3;

let authClient: GoogleAuth | null = null;

const getFcmConfig = (): { projectId: string; credentials: object } | null => {
  const projectId = process.env.FCM_PROJECT_ID;
  const jsonRaw = process.env.FCM_SERVICE_ACCOUNT_JSON;
  if (!projectId || !jsonRaw) return null;

  try {
    return { projectId, credentials: JSON.parse(jsonRaw) as object };
  } catch {
    return null;
  }
};

const getAuthClient = (): GoogleAuth | null => {
  const config = getFcmConfig();
  if (!config) return null;
  if (!authClient) {
    authClient = new GoogleAuth({
      credentials: config.credentials,
      scopes: [FCM_SCOPE],
    });
  }
  return authClient;
};

const shouldDebounce = async (recipientId: string, conversationId: string): Promise<boolean> => {
  const ready = await ensureRedisReady();
  if (!ready) return false;

  const redis = getRedisClient();
  const key = `chat:push:debounce:${recipientId}:${conversationId}`;
  const exists = await redis.get(key);
  if (exists) return true;

  await redis.setex(key, DEBOUNCE_SECONDS, '1');
  return false;
};

export interface ChatPushParams {
  recipientId: string;
  senderName: string;
  conversationId: string;
  messageId: string;
  previewText: string;
  messageType: string;
  mutedUntil?: Date | null;
}

export const sendChatPushNotification = async (params: ChatPushParams): Promise<boolean> => {
  const {
    recipientId,
    senderName,
    conversationId,
    messageId,
    previewText,
    messageType,
    mutedUntil,
  } = params;

  if (mutedUntil && mutedUntil > new Date()) {
    return false;
  }

  const user = await User.findById(recipientId).select('notificationPreferences');
  if (!user) return false;

  if (!user.notificationPreferences.tenantMessages) return false;
  if (!user.notificationPreferences.pushNotifications) return false;

  if (await shouldDebounce(recipientId, conversationId)) {
    return false;
  }

  const config = getFcmConfig();
  const auth = getAuthClient();
  if (!config || !auth) {
    logger.warn(`FCM not configured — chat push skipped for ${recipientId}`);
    return false;
  }

  const tokens = await DeviceToken.find({ userId: recipientId, isActive: true }).select('token');
  if (tokens.length === 0) return false;

  const body =
    messageType === 'text'
      ? previewText
      : messageType === 'image'
        ? 'Photo'
        : messageType === 'audio'
          ? 'Audio'
          : 'Document';

  try {
    const client = await auth.getClient();
    const accessToken = await client.getAccessToken();
    if (!accessToken.token) return false;

    const url = `https://fcm.googleapis.com/v1/projects/${config.projectId}/messages:send`;
    let sent = 0;

    for (const { token } of tokens) {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            token,
            notification: { title: senderName, body },
            data: {
              type: 'chat_message',
              conversationId,
              messageId,
              click_action: 'FLUTTER_NOTIFICATION_CLICK',
            },
            android: { priority: 'HIGH', notification: { channelId: 'chat_messages' } },
            apns: { headers: { 'apns-priority': '10' } },
          },
        }),
      });

      if (res.ok) {
        sent++;
      } else {
        const errText = await res.text();
        if (res.status === 404 || errText.includes('UNREGISTERED')) {
          await DeviceToken.updateOne({ token }, { isActive: false });
        }
        logger.error(`Chat FCM failed: ${res.status} ${errText}`);
      }
    }

    return sent > 0;
  } catch (err) {
    logger.error(`Chat FCM error: ${err instanceof Error ? err.message : 'Unknown'}`);
    return false;
  }
};
