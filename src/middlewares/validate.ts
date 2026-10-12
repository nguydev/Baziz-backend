import type { Request, Response, NextFunction, RequestHandler } from 'express';
import type { Schema } from 'joi';
import ApiError from '../utils/ApiError';

type RequestProperty = 'body' | 'query' | 'params';

const validate =
  (schema: Schema, property: RequestProperty = 'body'): RequestHandler =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errors = error.details.map((detail) => detail.message);
      next(ApiError.badRequest('Validation failed', errors));
      return;
    }

    req[property] = value;
    next();
  };

export default validate;
