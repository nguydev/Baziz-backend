import type { Request, Response, NextFunction } from 'express';
import logger from '../config/logger';
import env from '../config/env';

export const requestLoggerMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (env.NODE_ENV === 'test') {
    next();
    return;
  }

  res.on('finish', () => {
    const durationMs = Date.now() - (req.startTime ?? Date.now());
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';

    logger.log(level, 'HTTP request completed', {
      requestId: req.requestId,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      durationMs,
      userId: req.user?._id?.toString(),
    });
  });

  next();
};
