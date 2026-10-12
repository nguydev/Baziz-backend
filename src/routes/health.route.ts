import { Router, type Request, type Response } from 'express';
import mongoose from 'mongoose';
import env from '../config/env';
import { ensureRedisReady, getRedisClient, isRedisEnabled } from '../config/redis';

const router = Router();

router.get('/live', (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    status: 'alive',
    timestamp: new Date().toISOString(),
  });
});

router.get('/ready', async (_req: Request, res: Response) => {
  const checks: Record<string, { status: string; latencyMs?: number }> = {};

  // MongoDB check
  const mongoStart = Date.now();
  try {
    if (mongoose.connection.readyState !== 1) {
      checks.mongodb = { status: 'down' };
    } else {
      await mongoose.connection.db?.admin().ping();
      checks.mongodb = { status: 'up', latencyMs: Date.now() - mongoStart };
    }
  } catch {
    checks.mongodb = { status: 'down' };
  }

  // Redis check (optional — reported but does not block readiness)
  if (env.NODE_ENV !== 'test') {
    if (!isRedisEnabled()) {
      checks.redis = { status: 'disabled' };
    } else {
      const redisStart = Date.now();
      try {
        const ready = await ensureRedisReady();
        if (!ready) {
          checks.redis = { status: 'down' };
        } else {
          const redis = getRedisClient();
          const pong = await redis.ping();
          checks.redis = {
            status: pong === 'PONG' ? 'up' : 'down',
            latencyMs: Date.now() - redisStart,
          };
        }
      } catch {
        checks.redis = { status: 'down' };
      }
    }
  } else {
    checks.redis = { status: 'skipped' };
  }

  const mongoUp = checks.mongodb?.status === 'up';
  const allUp = mongoUp;
  const statusCode = allUp ? 200 : 503;

  res.status(statusCode).json({
    success: allUp,
    status: allUp ? 'ready' : 'not_ready',
    version: env.API_VERSION,
    checks,
    timestamp: new Date().toISOString(),
  });
});

// Backward-compatible health endpoint
router.get('/', (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'API is running',
    version: env.API_VERSION,
    timestamp: new Date().toISOString(),
  });
});

export default router;
