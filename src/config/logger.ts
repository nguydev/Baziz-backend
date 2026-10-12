import winston from 'winston';
import env from './env';

const { combine, timestamp, errors, json, printf, colorize } = winston.format;

const devFormat = printf(({ level, message, timestamp: ts, stack, ...meta }) => {
  const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  return `${ts} [${level}]: ${stack || message}${metaStr}`;
});

const logger = winston.createLogger({
  level: env.LOG_LEVEL || (env.NODE_ENV === 'production' ? 'info' : 'debug'),
  defaultMeta: { service: 'b-aziz-backend', env: env.NODE_ENV },
  format:
    env.NODE_ENV === 'production'
      ? combine(errors({ stack: true }), timestamp(), json())
      : combine(errors({ stack: true }), timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), devFormat),
  transports: [
    new winston.transports.Console({
      format:
        env.NODE_ENV === 'production'
          ? combine(timestamp(), json())
          : combine(colorize(), devFormat),
    }),
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: combine(timestamp(), json()),
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      format: combine(timestamp(), json()),
    }),
  ],
  exitOnError: false,
});

export default logger;
