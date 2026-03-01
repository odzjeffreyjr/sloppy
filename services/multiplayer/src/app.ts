import http from 'node:http';
import express from 'express';
import {
  createDatabase,
  createSessionRepository,
  createGameRepository,
} from '@sloppy/db';
import { createLogger, requestLoggerMiddleware, sentryErrorMiddleware, initSentry } from '@sloppy/logger';
import { config } from './config.js';
import { closeRedis } from './redis.js';
import { createWebSocketServer } from './ws-server.js';
import { sessionsRouter } from './routes/sessions.js';
import { startCleanupJob, stopCleanupJob } from './cleanup.js';
import { getAllRooms, destroyRoom } from './room-manager.js';
import { getMetrics, startMetricsLogging, stopMetricsLogging } from './metrics.js';

const log = createLogger('multiplayer');
const startedAt = Date.now();

initSentry(process.env.SENTRY_DSN, 'multiplayer');

const app = express();

app.use(express.json());
app.use(requestLoggerMiddleware(log));

const db = createDatabase();
const sessionRepo = createSessionRepository(db);
const gameRepo = createGameRepository(db);

app.get('/health', (_req, res) => {
  const metrics = getMetrics();
  res.json({
    status: 'ok',
    service: 'multiplayer',
    version: process.env.npm_package_version ?? '0.0.0',
    uptime: Math.floor((Date.now() - startedAt) / 1000),
    dependencies: { db: 'connected', redis: 'connected' },
    metrics,
  });
});

app.use('/multiplayer', sessionsRouter(sessionRepo, gameRepo));

app.use(sentryErrorMiddleware);

const server = http.createServer(app);

const wss = createWebSocketServer(server);

startCleanupJob(sessionRepo);
startMetricsLogging();

server.listen(config.port, () => {
  log.info(
    {
      port: config.port,
      tickRate: config.tickRate,
      maxSessions: config.maxConcurrentSessions,
      maxPlayersPerSession: config.maxPlayersPerSession,
    },
    'multiplayer service listening',
  );
});

async function shutdown(signal: string): Promise<void> {
  log.info({ signal }, 'shutting down gracefully');

  stopCleanupJob();
  stopMetricsLogging();

  for (const [sessionId] of getAllRooms()) {
    await destroyRoom(sessionId, 'Server shutting down');
  }

  wss.close();

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

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

export default app;
