import Redis, { type RedisOptions } from 'ioredis';
import type { QueueOptions } from 'bull';
import env from './env';
import logger from './logger';

let redisClient: Redis | null = null;

export const isRedisEnabled = (): boolean => env.REDIS_ENABLED === 'true';

const REDIS_RETRY_DELAY_MS = 200;
const REDIS_MAX_RETRY_DELAY_MS = 5000;

/** Keep reconnecting on transient drops (idle timeout, network blips). */
const redisRetryStrategy = (times: number): number =>
  Math.min(times * REDIS_RETRY_DELAY_MS, REDIS_MAX_RETRY_DELAY_MS);

const redisReconnectOnError = (err: Error): boolean => {
  const msg = err.message;
  return (
    msg.includes('READONLY') ||
    msg.includes('ECONNRESET') ||
    msg.includes('ETIMEDOUT') ||
    msg.includes('ECONNREFUSED') ||
    msg.includes('MaxRetriesPerRequestError')
  );
};

const buildRedisOptions = (maxRetriesPerRequest: number | null): RedisOptions => ({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD || undefined,
  tls: env.REDIS_TLS === 'true' ? {} : undefined,
  maxRetriesPerRequest,
  lazyConnect: true,
  retryStrategy: redisRetryStrategy,
  reconnectOnError: redisReconnectOnError,
  enableOfflineQueue: false,
});

const attachRedisListeners = (client: Redis, label: string): void => {
  client.on('connect', () => logger.info(`Redis connected (${label})`));
  client.on('ready', () => logger.info(`Redis ready (${label})`));
  client.on('error', (err) => logger.warn(`Redis error (${label}): ${err.message}`));
  client.on('close', () => logger.warn(`Redis connection closed (${label})`));
  client.on('reconnecting', () => logger.info(`Redis reconnecting (${label})`));
};

export const getRedisClient = (): Redis => {
  if (!isRedisEnabled()) {
    throw new Error('Redis is disabled (REDIS_ENABLED=false)');
  }

  if (redisClient) return redisClient;

  redisClient = new Redis({
    ...buildRedisOptions(3),
    enableReadyCheck: true,
  });

  attachRedisListeners(redisClient, 'app');

  return redisClient;
};

/**
 * Bull requires maxRetriesPerRequest: null on all queue connections
 * to avoid MaxRetriesPerRequestError on blocking commands.
 */
export const getBullQueueOptions = (): QueueOptions => {
  if (!isRedisEnabled()) {
    throw new Error('Redis is disabled (REDIS_ENABLED=false)');
  }

  return {
  createClient: (type) => {
    const label = `bull:${type}`;
    const client = new Redis({
      ...buildRedisOptions(null),
      enableReadyCheck: false,
      lazyConnect: false,
    });
    attachRedisListeners(client, label);
    return client;
  },
  };
};

const isClientReady = (client: Redis): boolean =>
  (client.status as Redis['status'] | 'ready') === 'ready';

export const isRedisReady = (): boolean => {
  if (!isRedisEnabled()) return false;
  const client = redisClient;
  return client != null && isClientReady(client);
};

/**
 * Ensure the shared app Redis client is connected before token blacklist ops.
 */
export const ensureRedisReady = async (timeoutMs = 3000): Promise<boolean> => {
  if (!isRedisEnabled()) return false;

  const client = getRedisClient();
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (isClientReady(client)) return true;

    if (client.status === 'end') {
      return false;
    }

    if (client.status === 'wait') {
      try {
        await client.connect();
      } catch {
        // retry until timeout
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return isClientReady(client);
};

export const connectRedis = async (): Promise<void> => {
  if (!isRedisEnabled()) {
    logger.info('Redis disabled (REDIS_ENABLED=false). Skipping connection.');
    return;
  }

  const client = getRedisClient();
  try {
    if (client.status === 'wait') {
      await client.connect();
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.warn(`Redis unavailable: ${message}. Continuing without Redis.`);
  }
};

export const disconnectRedis = async (): Promise<void> => {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    logger.info('Redis connection closed');
  }
};
