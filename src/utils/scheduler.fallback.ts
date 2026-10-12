/**
 * In-process scheduler fallback when Redis/Bull is unavailable.
 * Uses UTC timers — suitable for single-instance dev/small deployments.
 */

import logger from '../config/logger';

type FallbackJob = {
  name: string;
  intervalMs: number;
  run: () => Promise<void>;
  /** Only run when this returns true (checked each tick) */
  shouldRun?: () => boolean;
};

const jobs: FallbackJob[] = [];
const timers: NodeJS.Timeout[] = [];

export const registerFallbackJob = (job: FallbackJob): void => {
  jobs.push(job);
};

export const startFallbackScheduler = (): void => {
  if (timers.length > 0) return;

  for (const job of jobs) {
    const timer = setInterval(async () => {
      if (job.shouldRun && !job.shouldRun()) return;
      try {
        await job.run();
      } catch (err) {
        logger.error(
          `Fallback job "${job.name}" failed: ${err instanceof Error ? err.message : 'Unknown'}`
        );
      }
    }, job.intervalMs);

    timers.push(timer);
    logger.info(`Fallback scheduler: "${job.name}" every ${Math.round(job.intervalMs / 60000)} min`);
  }
};

export const stopFallbackScheduler = (): void => {
  timers.forEach(clearInterval);
  timers.length = 0;
};

/** True once per UTC day at a given hour — checked within first 15 min of that hour */
export const isUtcHourOncePerDay = (hour: number, date: Date = new Date()): boolean =>
  date.getUTCHours() === hour && date.getUTCMinutes() < 15;

/** True on every even UTC hour (0, 2, 4, …) */
export const isEvenUtcHour = (date: Date = new Date()): boolean =>
  date.getUTCHours() % 2 === 0 && date.getUTCMinutes() < 15;
