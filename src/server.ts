import './types/express';
import http from 'http';
import app from './app';
import env from './config/env';
import logger from './config/logger';
import { connectDB, disconnectDB } from './config/db';
import { connectRedis, disconnectRedis, isRedisEnabled } from './config/redis';
import { initFirebase } from './config/firebase';
import { initSocketIO } from './modules/chat/chat.socket';
import { initJobs } from './jobs/email.job';
import { initCleanupJob } from './jobs/cleanup.job';
import { initTaskJob } from './jobs/task.job';
import { initRentBillingJob } from './jobs/rent-billing.job';
import { initRentReminderJob } from './jobs/rent-reminder.job';
import { initSentry } from './config/sentry';
import { initMetrics } from './config/metrics';
import { isStripeConfigured, isPublishableKeyConfigured } from './modules/rent-payment/stripe.service';

let isShuttingDown = false;
let httpServerInstance: http.Server | null = null;

const isNonFatalRejection = (reason: unknown): boolean => {
  const message =
    reason instanceof Error
      ? reason.message
      : typeof reason === 'string'
        ? reason
        : JSON.stringify(reason);

  const lower = message.toLowerCase();
  return (
    lower.includes('redis') ||
    lower.includes('bull') ||
    lower.includes('econnrefused') ||
    lower.includes('maxretriesperrequest') ||
    lower.includes('repeat') ||
    lower.includes('already exists') ||
    lower.includes('enableofflinequeue') ||
    lower.includes("stream isn't writeable")
  );
};

const shutdown = async (signal: string): Promise<void> => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info(`${signal} received. Shutting down gracefully...`);

  const closeServer = (): Promise<void> =>
    new Promise((resolve) => {
      if (!httpServerInstance) {
        resolve();
        return;
      }
      httpServerInstance.close(() => resolve());
    });

  await closeServer();
  await disconnectDB();
  await disconnectRedis();
  logger.info('Server closed');
  process.exit(0);
};

process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
  if (isNonFatalRejection(reason)) {
    logger.warn('Non-fatal unhandled rejection (ignored):', {
      reason: reason instanceof Error ? reason.message : reason,
    });
    return;
  }

  logger.error('UNHANDLED_REJECTION received. Shutting down gracefully...', {
    reason: reason instanceof Error ? reason.message : reason,
    promise: promise.toString(),
  });
  void shutdown('UNHANDLED_REJECTION');
});

process.on('uncaughtException', (err: Error) => {
  logger.error('UNCAUGHT_EXCEPTION received. Shutting down gracefully...', err);
  void shutdown('UNCAUGHT_EXCEPTION');
});

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

const startServer = async (): Promise<void> => {
  try {
    initSentry();
    initMetrics();

    await connectDB();

    try {
      const { seedInitialRatesIfEmpty } = await import('./modules/stamp-duty/stamp-duty.service');
      await seedInitialRatesIfEmpty();
      logger.info('Stamp duty rates seeded successfully (if empty)');
    } catch (seedErr) {
      logger.warn('Failed to seed initial stamp duty rates:', seedErr);
    }

    try {
      if (isRedisEnabled()) {
        await connectRedis();
        initJobs();
        initCleanupJob();
        initTaskJob();
        initRentBillingJob();
        initRentReminderJob();
      } else {
        logger.info('Redis disabled — background job queues skipped');
      }
    } catch (err) {
      logger.warn(
        `Redis connection failed: ${err instanceof Error ? err.message : 'Unknown error'}. Continuing without Redis.`
      );
    }

    initFirebase();

    httpServerInstance = http.createServer(app);
    await initSocketIO(httpServerInstance);

    if (isStripeConfigured()) {
      logger.info('Stripe payments: configured (secret key)');
    } else {
      logger.warn(
        'Stripe payments: NOT configured — set STRIPE_SECRET_KEY in .env and restart server'
      );
    }

    if (isPublishableKeyConfigured()) {
      logger.info('Stripe publishable key: configured (card / Apple Pay UI)');
    } else {
      logger.warn(
        'Stripe publishable key: NOT set — add STRIPE_PUBLISHABLE_KEY=pk_test_... for payment tester UI'
      );
    }

    httpServerInstance.listen(env.PORT, () => {
      logger.info(`Server running in ${env.NODE_ENV} mode on port ${env.PORT}`);
      logger.info(`API docs: http://localhost:${env.PORT}/api-docs`);
      logger.info(`Metrics: http://localhost:${env.PORT}/metrics`);
      logger.info(`Health: http://localhost:${env.PORT}/api/${env.API_VERSION}/health/ready`);
    });
  } catch (err) {
    logger.error('Failed to start server:', err);
    process.exit(1);
  }
};

void startServer();
