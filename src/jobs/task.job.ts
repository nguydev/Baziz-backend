/**
 * Task Job
 * Daily cron: promotes overdue "upcoming" tasks → "today"
 * Runs at midnight UTC (00:05) to catch any tasks whose dueDate passed
 */

import Bull, { Queue } from 'bull';
import logger from '../config/logger';
import { getBullQueueOptions } from '../config/redis';
import Task from '../modules/task/task.model';
import { attachQueueErrorHandler, scheduleRepeatJob } from './queue.helpers';

let taskQueue: Queue | null = null;

export const initTaskJob = (): void => {
  try {
    taskQueue = new Bull('task-maintenance', getBullQueueOptions());
    attachQueueErrorHandler(taskQueue, 'task-maintenance');

    taskQueue.process(async () => {
      const now = new Date();
      now.setUTCHours(0, 0, 0, 0); // start of today UTC

      // Promote overdue upcoming tasks → today
      const result = await Task.updateMany(
        {
          status: 'upcoming',
          dueDate: { $lt: now },
          isActive: true,
        },
        { $set: { status: 'today' } }
      );

      if (result.modifiedCount > 0) {
        logger.info(`Task job: promoted ${result.modifiedCount} overdue tasks to "today"`);
      }
    });

    scheduleRepeatJob(taskQueue, 'task-maintenance', '5 0 * * *');
    logger.info('Task maintenance job initialized (daily at 00:05 UTC)');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.warn(`Task job unavailable: ${message}`);
  }
};
