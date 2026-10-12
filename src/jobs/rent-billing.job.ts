/**
 * Rent Billing Job — auto-create monthly bills on 1st + mark overdue daily
 */

import Bull, { Queue } from 'bull';
import logger from '../config/logger';
import { getBullQueueOptions } from '../config/redis';
import {
  generateMonthlyRentBills,
  markOverduePayments,
} from '../modules/rent-payment/rent-payment.service';
import { isFirstOfMonthUtc } from '../modules/rent-payment/rent-payment.utils';
import {
  registerFallbackJob,
  startFallbackScheduler,
  isUtcHourOncePerDay,
} from '../utils/scheduler.fallback';
import { attachQueueErrorHandler, scheduleRepeatJob } from './queue.helpers';

let billingQueue: Queue | null = null;
let overdueQueue: Queue | null = null;
let usingFallback = false;

const runBilling = async (): Promise<void> => {
  await generateMonthlyRentBills();
};

const runOverdue = async (): Promise<void> => {
  await markOverduePayments();
};

export const initRentBillingJob = (): void => {
  try {
    billingQueue = new Bull('rent-billing', getBullQueueOptions());
    overdueQueue = new Bull('rent-overdue', getBullQueueOptions());
    attachQueueErrorHandler(billingQueue, 'rent-billing');
    attachQueueErrorHandler(overdueQueue, 'rent-overdue');

    billingQueue.process(async () => {
      await runBilling();
    });

    overdueQueue.process(async () => {
      await runOverdue();
    });

    scheduleRepeatJob(billingQueue, 'rent-billing', '10 0 1 * *');
    scheduleRepeatJob(overdueQueue, 'rent-overdue', '15 0 * * *');
    logger.info('Rent billing jobs initialized');
  } catch (err) {
    logger.warn(
      `Rent billing Bull queue unavailable: ${err instanceof Error ? err.message : 'Unknown'}`
    );
    initFallbackBilling();
  }
};

const initFallbackBilling = (): void => {
  if (usingFallback) return;
  usingFallback = true;

  registerFallbackJob({
    name: 'rent-billing-fallback',
    intervalMs: 15 * 60 * 1000,
    shouldRun: () => isFirstOfMonthUtc() && isUtcHourOncePerDay(0),
    run: runBilling,
  });

  registerFallbackJob({
    name: 'rent-overdue-fallback',
    intervalMs: 15 * 60 * 1000,
    shouldRun: () => isUtcHourOncePerDay(0),
    run: runOverdue,
  });

  startFallbackScheduler();
  logger.info('Rent billing/overdue using in-process fallback scheduler (Redis unavailable)');
};
