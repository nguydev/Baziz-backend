import Bull, { Queue } from 'bull';
import logger from '../config/logger';
import { getBullQueueOptions } from '../config/redis';
import User from '../modules/user/user.model';
import { processExpiredGracePeriods } from '../modules/billing/billing.service';
import { attachQueueErrorHandler, scheduleRepeatJob } from './queue.helpers';

let cleanupQueue: Queue | null = null;

export const initCleanupJob = (): void => {
  try {
    cleanupQueue = new Bull('cleanup', getBullQueueOptions());
    attachQueueErrorHandler(cleanupQueue, 'cleanup');

    cleanupQueue.process(async () => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const result = await User.deleteMany({
        isActive: false,
        updatedAt: { $lt: thirtyDaysAgo },
      });

      logger.info(`Cleanup job: removed ${result.deletedCount} inactive users`);

      const downgraded = await processExpiredGracePeriods();
      if (downgraded > 0) {
        logger.info(`Cleanup job: downgraded ${downgraded} expired grace-period subscriptions`);
      }
    });

    scheduleRepeatJob(cleanupQueue, 'cleanup', '0 2 * * *');
    logger.info('Cleanup job initialized (daily at 2 AM)');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.warn(`Cleanup job unavailable: ${message}`);
  }
};
