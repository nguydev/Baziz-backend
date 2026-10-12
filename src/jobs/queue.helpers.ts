import type { Queue } from 'bull';
import logger from '../config/logger';

export const attachQueueErrorHandler = (queue: Queue, name: string): void => {
  queue.on('error', (err) => {
    logger.warn(`Bull queue "${name}" error: ${err.message}`);
  });
};

/** Schedule a cron repeat job without crashing the process on duplicate/existing keys. */
export const scheduleRepeatJob = (
  queue: Queue,
  name: string,
  cron: string
): void => {
  void queue
    .add({}, { repeat: { cron } })
    .then(() => {
      logger.info(`Bull queue "${name}" repeat scheduled (${cron})`);
    })
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      logger.warn(`Bull queue "${name}" repeat schedule skipped: ${message}`);
    });
};
