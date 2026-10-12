import type { Request, Response, NextFunction } from 'express';
import { Error as MongooseError } from 'mongoose';
import ApiError from '../utils/ApiError';
import logger from '../config/logger';
import env from '../config/env';
import { captureError } from '../config/sentry';
import { httpErrorsTotal, normalizeRoute } from '../config/metrics';

interface MongoDuplicateKeyError extends Error {
  code?: number;
  keyValue?: Record<string, unknown>;
}

interface MongoCastError extends Error {
  path?: string;
  value?: unknown;
}

const errorHandler = (err: Error, req: Request, res: Response, _next: NextFunction): void => {
  let statusCode = (err as ApiError).statusCode || 500;
  let message = err.message || 'Internal server error';
  let errors: string[] = (err as ApiError).errors || [];

  if (err instanceof MongooseError.ValidationError) {
    statusCode = 400;
    message = 'Validation failed';
    errors = Object.values(err.errors).map((e) => e.message);
  }

  const duplicateError = err as MongoDuplicateKeyError;
  if (duplicateError.code === 11000 && duplicateError.keyValue) {
    statusCode = 409;
    const field = Object.keys(duplicateError.keyValue)[0];
    message = `${field} already exists`;
  }

  const castError = err as MongoCastError;
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid ${castError.path}: ${castError.value}`;
  }

  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  }

  const logContext = {
    requestId: req.requestId,
    method: req.method,
    url: req.originalUrl,
    statusCode,
    userId: req.user?._id?.toString(),
  };

  if (statusCode >= 500) {
    logger.error(message, { ...logContext, stack: err.stack });
    captureError(err, logContext);
  } else if (statusCode >= 400) {
    logger.warn(message, { ...logContext, validationErrors: errors });
  }

  if (env.METRICS_ENABLED && env.NODE_ENV !== 'test') {
    const route = normalizeRoute(req.route?.path ? `${req.baseUrl}${req.route.path}` : req.path);
    httpErrorsTotal.inc({
      method: req.method,
      route,
      status_code: String(statusCode),
    });
  }

  res.status(statusCode).json({
    success: false,
    statusCode,
    message,
    requestId: req.requestId,
    ...(errors.length && { errors }),
    ...((err as ApiError).code && { code: (err as ApiError).code }),
    ...(env.NODE_ENV === 'development' && statusCode >= 500 && { stack: err.stack }),
  });
};

const notFoundHandler = (req: Request, _res: Response, next: NextFunction): void => {
  next(ApiError.notFound(`Route ${req.originalUrl} not found`));
};

export { errorHandler, notFoundHandler };
