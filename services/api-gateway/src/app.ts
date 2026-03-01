import express from 'express';
import cors from 'cors';
import { optionalAuth } from '@sloppy/auth-middleware';
import { createLogger, requestLoggerMiddleware, sentryErrorMiddleware, initSentry } from '@sloppy/logger';
import { config } from './config.js';
import { requestId } from './middleware/request-id.js';
import { createGeneralRateLimit, createGenerationRateLimit } from './middleware/rate-limit.js';
import { notFoundHandler, errorHandler } from './middleware/error-handler.js';
import { mountProxyRoutes } from './proxy.js';
import { healthCheck } from './health.js';
import { closeRedis } from './redis.js';

const log = createLogger('api-gateway');

initSentry(process.env.SENTRY_DSN, 'api-gateway');

const app = express();

app.set('trust proxy', 1);

app.use(
  cors({
    origin: config.corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    exposedHeaders: ['X-Request-ID', 'Retry-After'],
  }),
);

app.use(express.json({ limit: config.bodyLimit }));
app.use(requestId);
app.use(requestLoggerMiddleware(log));
app.use(optionalAuth);
app.use(createGeneralRateLimit());

app.get('/health', healthCheck);

mountProxyRoutes(app, createGenerationRateLimit());

app.use(sentryErrorMiddleware);
app.use(notFoundHandler);
app.use(errorHandler);

const server = app.listen(config.port, () => {
  log.info({ port: config.port }, 'api-gateway listening');
});

async function shutdown(signal: string) {
  log.info({ signal }, 'shutting down gracefully');

  server.close(async () => {
    await closeRedis();
    log.info('shutdown complete');
    process.exit(0);
  });

  setTimeout(() => {
    log.error('forced shutdown after timeout');
    process.exit(1);
  }, 10_000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default app;
