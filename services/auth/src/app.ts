import express from 'express';
import { createDatabase, createUserRepository } from '@sloppy/db';
import { authenticateRequest, requireAuth } from '@sloppy/auth-middleware';
import { createLogger, requestLoggerMiddleware, sentryErrorMiddleware, initSentry } from '@sloppy/logger';
import { syncRouter } from './routes/sync.js';
import { meRouter } from './routes/me.js';

const log = createLogger('auth');
const startedAt = Date.now();

initSentry(process.env.SENTRY_DSN, 'auth');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(express.json());
app.use(requestLoggerMiddleware(log));

const db = createDatabase();
const userRepo = createUserRepository(db);

app.use('/auth/sync', authenticateRequest, syncRouter(userRepo));
app.use('/auth/me', authenticateRequest, requireAuth, meRouter(userRepo));

app.get('/auth/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'auth',
    version: process.env.npm_package_version ?? '0.0.0',
    uptime: Math.floor((Date.now() - startedAt) / 1000),
    dependencies: { db: 'connected' },
  });
});

app.use(sentryErrorMiddleware);

app.listen(PORT, () => {
  log.info({ port: PORT }, 'auth service listening');
});

export default app;
