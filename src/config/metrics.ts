import client from 'prom-client';
import env from './env';

export const register = new client.Registry();

client.collectDefaultMetrics({
  register,
  labels: { app: 'b-aziz-backend' },
});

export const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'] as const,
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5, 10],
  registers: [register],
});

export const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'] as const,
  registers: [register],
});

export const httpErrorsTotal = new client.Counter({
  name: 'http_errors_total',
  help: 'Total number of HTTP error responses (4xx and 5xx)',
  labelNames: ['method', 'route', 'status_code'] as const,
  registers: [register],
});

export const initMetrics = (): void => {
  if (!env.METRICS_ENABLED) return;
  register.setDefaultLabels({ app: 'b-aziz-backend', env: env.NODE_ENV });
};

export const getMetrics = async (): Promise<string> => {
  return register.metrics();
};

export const getMetricsContentType = (): string => {
  return register.contentType;
};

/** Normalize dynamic route params for consistent metric labels */
export const normalizeRoute = (url: string): string => {
  return url
    .split('?')[0]
    .replace(/\/[0-9a-fA-F]{24}/g, '/:id')
    .replace(/\/\d+/g, '/:id');
};
