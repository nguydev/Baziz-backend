import type { Request, Response, NextFunction } from 'express';
import env from '../config/env';
import {
  httpRequestDuration,
  httpRequestsTotal,
  httpErrorsTotal,
  normalizeRoute,
} from '../config/metrics';

export const metricsMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!env.METRICS_ENABLED || env.NODE_ENV === 'test') {
    next();
    return;
  }

  res.on('finish', () => {
    const duration = (Date.now() - (req.startTime ?? Date.now())) / 1000;
    const route = normalizeRoute(req.route?.path ? `${req.baseUrl}${req.route.path}` : req.path);
    const labels = {
      method: req.method,
      route,
      status_code: String(res.statusCode),
    };

    httpRequestDuration.observe(labels, duration);
    httpRequestsTotal.inc(labels);

    if (res.statusCode >= 400) {
      httpErrorsTotal.inc(labels);
    }
  });

  next();
};
