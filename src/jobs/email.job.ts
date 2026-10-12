import Bull, { Queue } from 'bull';
import logger from '../config/logger';
import { getBullQueueOptions } from '../config/redis';
import sendEmail from '../utils/sendEmail';
import type { EmailPayload } from '../types/api.types';
import { attachQueueErrorHandler } from './queue.helpers';

let emailQueue: Queue<EmailPayload> | null = null;

export const initJobs = (): void => {
  try {
    emailQueue = new Bull<EmailPayload>('email', getBullQueueOptions());
    attachQueueErrorHandler(emailQueue, 'email');

    emailQueue.process(async (job) => {
      const { to, subject, html } = job.data;
      await sendEmail({ to, subject, html });
    });

    emailQueue.on('failed', (job, err) => {
      logger.error(`Email job ${job?.id} failed: ${err.message}`);
    });

    logger.info('Email job queue initialized');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.warn(`Job queue unavailable: ${message}`);
  }
};

export const queueEmail = async (emailData: EmailPayload) => {
  if (!emailQueue) {
    return sendEmail(emailData);
  }

  return emailQueue.add(emailData, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
  });
};
