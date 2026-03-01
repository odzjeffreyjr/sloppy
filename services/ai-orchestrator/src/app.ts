import express from 'express';
import { createLogger, requestLoggerMiddleware, sentryErrorMiddleware, initSentry } from '@sloppy/logger';
import { config } from './config.js';
import { getRedis, closeRedis } from './redis.js';
import { generateRouter } from './routes/generate.js';
import { statusRouter } from './routes/status.js';

const log = createLogger('ai-orchestrator');
const startedAt = Date.now();

initSentry(process.env.SENTRY_DSN, 'ai-orchestrator');

const app = express();

app.use(express.json());
app.use(requestLoggerMiddleware(log));

app.get('/health', async (_req, res) => {
  try {
    const redis = getRedis();
    await redis.ping();
    res.json({
      status: 'ok',
      service: 'ai-orchestrator',
      version: process.env.npm_package_version ?? '0.0.0',
      uptime: Math.floor((Date.now() - startedAt) / 1000),
      provider: config.llm.provider,
      dependencies: { redis: 'connected' },
    });
  } catch {
    res.status(503).json({
      status: 'degraded',
      service: 'ai-orchestrator',
      version: process.env.npm_package_version ?? '0.0.0',
      uptime: Math.floor((Date.now() - startedAt) / 1000),
      dependencies: { redis: 'unavailable' },
    });
  }
});

app.use('/generate', generateRouter());
app.use('/generate', statusRouter());

app.use(sentryErrorMiddleware);

const server = app.listen(config.port, () => {
  log.info({ port: config.port, provider: config.llm.provider }, 'ai-orchestrator listening');
});

async function shutdown(signal: string): Promise<void> {
  log.info({ signal }, 'shutting down');

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
