/**
 * Rent Reminder Job — every 2 hours, 5 days before due until paid
 */

import Bull, { Queue } from 'bull';
import logger from '../config/logger';
import { getBullQueueOptions } from '../config/redis';
import { processRentReminders } from '../modules/rent-payment/rent-payment.service';
import {
  registerFallbackJob,
  startFallbackScheduler,
  isEvenUtcHour,
} from '../utils/scheduler.fallback';
import { attachQueueErrorHandler, scheduleRepeatJob } from './queue.helpers';

let reminderQueue: Queue | null = null;
let usingFallback = false;

export const initRentReminderJob = (): void => {
  try {
    reminderQueue = new Bull('rent-reminders', getBullQueueOptions());
    attachQueueErrorHandler(reminderQueue, 'rent-reminders');

    reminderQueue.process(async () => {
      await processRentReminders();
    });

    scheduleRepeatJob(reminderQueue, 'rent-reminders', '0 */2 * * *');
    logger.info('Rent reminder job initialized (every 2 hours)');
  } catch (err) {
    logger.warn(
      `Rent reminder Bull queue unavailable: ${err instanceof Error ? err.message : 'Unknown'}`
    );
    initFallbackReminders();
  }
};

const initFallbackReminders = (): void => {
  if (usingFallback) return;
  usingFallback = true;

  registerFallbackJob({
    name: 'rent-reminders-fallback',
    intervalMs: 15 * 60 * 1000,
    shouldRun: isEvenUtcHour,
    run: async () => {
      await processRentReminders();
    },
  });

  startFallbackScheduler();
  logger.info('Rent reminders using in-process fallback scheduler (Redis unavailable)');
};
