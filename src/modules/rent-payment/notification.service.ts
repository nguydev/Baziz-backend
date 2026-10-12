/**
 * Notification delivery — email, SMS (Twilio), push (FCM)
 */

import logger from '../../config/logger';
import { queueEmail } from '../../jobs/email.job';
import { sendFcmPush } from './fcm.service';
import Notification, { type NotificationType } from './notification.model';

export const createInAppNotification = async (params: {
  userId: string;
  title: string;
  body: string;
  type: NotificationType;
  rentPaymentId?: string;
}): Promise<void> => {
  await Notification.create({
    userId: params.userId,
    title: params.title,
    body: params.body,
    type: params.type,
    rentPaymentId: params.rentPaymentId ?? null,
    read: false,
  });
};

export const sendEmailNotification = async (
  to: string,
  subject: string,
  html: string
): Promise<void> => {
  await queueEmail({ to, subject, html });
};

export const sendSmsNotification = async (
  to: string,
  message: string
): Promise<boolean> => {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;

  if (!sid || !token || !from) {
    logger.warn(`SMS not sent (Twilio not configured). To: ${to}`);
    return false;
  }

  try {
    const auth = Buffer.from(`${sid}:${token}`).toString('base64');
    const body = new URLSearchParams({ To: to, From: from, Body: message });

    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      }
    );

    if (!res.ok) {
      logger.error(`Twilio SMS failed: ${res.status} ${await res.text()}`);
      return false;
    }

    logger.info(`SMS sent to ${to}`);
    return true;
  } catch (err) {
    logger.error(`Twilio SMS error: ${err instanceof Error ? err.message : 'Unknown'}`);
    return false;
  }
};

export const sendPushNotification = async (
  userId: string,
  title: string,
  body: string
): Promise<boolean> => {
  // Prefer FCM HTTP v1 (service account)
  const v1Sent = await sendFcmPush(userId, title, body);
  if (v1Sent) return true;

  // Legacy fallback when FCM_SERVER_KEY is set (deprecated by Google)
  const serverKey = process.env.FCM_SERVER_KEY;
  if (!serverKey) {
    logger.warn(`Push not sent (FCM not configured). User: ${userId}`);
    return false;
  }

  const DeviceToken = (await import('./device-token.model')).default;
  const tokens = await DeviceToken.find({ userId, isActive: true }).select('token');
  if (tokens.length === 0) return false;

  try {
    const res = await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: {
        Authorization: `key=${serverKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        registration_ids: tokens.map((t) => t.token),
        notification: { title, body },
        priority: 'high',
      }),
    });

    if (!res.ok) {
      logger.error(`FCM legacy push failed: ${res.status}`);
      return false;
    }

    logger.info(`FCM legacy push sent to user ${userId} (${tokens.length} devices)`);
    return true;
  } catch (err) {
    logger.error(`FCM push error: ${err instanceof Error ? err.message : 'Unknown'}`);
    return false;
  }
};

export const notifyUserAllChannels = async (params: {
  userId: string;
  email: string;
  phone: string | null;
  title: string;
  body: string;
  type: NotificationType;
  rentPaymentId?: string;
  sendEmail?: boolean;
  sendSms?: boolean;
  sendPush?: boolean;
}): Promise<void> => {
  await createInAppNotification({
    userId: params.userId,
    title: params.title,
    body: params.body,
    type: params.type,
    rentPaymentId: params.rentPaymentId,
  });

  if (params.sendEmail !== false) {
    await sendEmailNotification(
      params.email,
      params.title,
      `<p>${params.body}</p>`
    );
  }

  if (params.sendSms && params.phone) {
    await sendSmsNotification(params.phone, `${params.title}: ${params.body}`);
  }

  if (params.sendPush !== false) {
    await sendPushNotification(params.userId, params.title, params.body);
  }
};
