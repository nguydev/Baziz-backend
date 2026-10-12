import Joi from 'joi';
import dotenv from 'dotenv';
import type { EnvConfig } from '../types/env.types';

dotenv.config();

const envSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(5000),
  API_VERSION: Joi.string().default('v1'),

  MONGODB_URI: Joi.string().required(),

  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').default(''),
  REDIS_TLS: Joi.string().valid('true', 'false').default('false'),
  REDIS_ENABLED: Joi.string().valid('true', 'false').default('true'),

  JWT_SECRET: Joi.string().required(),
  JWT_EXPIRES_IN: Joi.string().default('7d'),
  JWT_REFRESH_SECRET: Joi.string().required(),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('30d'),

  SMTP_HOST: Joi.string().default('smtp.gmail.com'),
  SMTP_PORT: Joi.number().default(587),
  SMTP_USER: Joi.string().allow('').default(''),
  SMTP_PASS: Joi.string().allow('').default(''),
  EMAIL_FROM: Joi.string().default('noreply@example.com'),

  RATE_LIMIT_WINDOW_MS: Joi.number().default(900000),
  RATE_LIMIT_MAX: Joi.number().default(100),

  CORS_ORIGIN: Joi.string().default('http://localhost:3000'),

  SENTRY_DSN: Joi.string().allow('').default(''),
  METRICS_ENABLED: Joi.boolean().default(true),
  LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'debug').default('info'),
}).unknown();

const { error, value } = envSchema.validate(process.env);

if (error) {
  throw new Error(`Environment validation error: ${error.message}`);
}

const env = value as EnvConfig;

export default env;
