import * as Sentry from '@sentry/node';
import env from './env';
import logger from './logger';

export const initSentry = (): void => {
  if (!env.SENTRY_DSN) {
    logger.info('Sentry DSN not configured — error reporting disabled');
    return;
  }

  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    tracesSampleRate: env.NODE_ENV === 'production' ? 0.2 : 1.0,
  });

  logger.info('Sentry initialized');
};

export const captureError = (
  error: Error,
  context?: Record<string, unknown>
): void => {
  if (!env.SENTRY_DSN) return;

  Sentry.withScope((scope) => {
    if (context) {
      scope.setContext('request', context);
    }
    Sentry.captureException(error);
  });
};

export { Sentry };
