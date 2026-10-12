export interface EnvConfig {
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: number;
  API_VERSION: string;
  MONGODB_URI: string;
  REDIS_HOST: string;
  REDIS_PORT: number;
  REDIS_PASSWORD: string;
  REDIS_TLS: string;
  REDIS_ENABLED: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  JWT_REFRESH_SECRET: string;
  JWT_REFRESH_EXPIRES_IN: string;
  SMTP_HOST: string;
  SMTP_PORT: number;
  SMTP_USER: string;
  SMTP_PASS: string;
  EMAIL_FROM: string;
  RATE_LIMIT_WINDOW_MS: number;
  RATE_LIMIT_MAX: number;
  CORS_ORIGIN: string;
  SENTRY_DSN: string;
  METRICS_ENABLED: boolean;
  LOG_LEVEL: string;
}
