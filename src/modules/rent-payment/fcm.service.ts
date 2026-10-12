/**
 * Firebase Cloud Messaging HTTP v1 API
 */

import { GoogleAuth } from 'google-auth-library';
import logger from '../../config/logger';
import DeviceToken from './device-token.model';

const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';

let authClient: GoogleAuth | null = null;

const getFcmConfig = (): { projectId: string; credentials: object } | null => {
  const projectId = process.env.FCM_PROJECT_ID;
  const jsonRaw = process.env.FCM_SERVICE_ACCOUNT_JSON;

  if (!projectId || !jsonRaw) return null;

  try {
    const credentials = JSON.parse(jsonRaw) as object;
    return { projectId, credentials };
  } catch {
    logger.error('FCM_SERVICE_ACCOUNT_JSON is not valid JSON');
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

export const isFcmConfigured = (): boolean => Boolean(getFcmConfig());

export const sendFcmPush = async (
  userId: string,
  title: string,
  body: string
): Promise<boolean> => {
  const config = getFcmConfig();
  const auth = getAuthClient();
  if (!config || !auth) {
    logger.warn(`FCM v1 not configured — push skipped for user ${userId}`);
    return false;
  }

  const tokens = await DeviceToken.find({ userId, isActive: true }).select('token');
  if (tokens.length === 0) return false;

  try {
    const client = await auth.getClient();
    const accessToken = await client.getAccessToken();
    if (!accessToken.token) {
      logger.error('FCM v1: failed to obtain access token');
      return false;
    }

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
            notification: { title, body },
            android: { priority: 'HIGH' },
            apns: { headers: { 'apns-priority': '10' } },
          },
        }),
      });

      if (res.ok) {
        sent++;
      } else {
        logger.error(`FCM v1 send failed: ${res.status} ${await res.text()}`);
      }
    }

    if (sent > 0) {
      logger.info(`FCM v1 push sent to user ${userId} (${sent}/${tokens.length} devices)`);
      return true;
    }

    return false;
  } catch (err) {
    logger.error(`FCM v1 error: ${err instanceof Error ? err.message : 'Unknown'}`);
    return false;
  }
};
