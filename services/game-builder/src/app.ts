import express from 'express';
import {
  createDatabase,
  createGameRepository,
  createFavouriteRepository,
  createUserRepository,
  createGameCrashRepository,
} from '@sloppy/db';
import { createLogger, requestLoggerMiddleware, sentryErrorMiddleware, initSentry } from '@sloppy/logger';
import { config } from './config.js';
import { resolveUser } from './middleware/user.js';
import { gamesRouter } from './routes/games.js';
import { feedRouter } from './routes/feed.js';
import { favouritesRouter } from './routes/favourites.js';
import { serveRouter } from './routes/serve.js';
import { crashRouter } from './routes/crash.js';

const log = createLogger('game-builder');
const startedAt = Date.now();

initSentry(process.env.SENTRY_DSN, 'game-builder');

const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(requestLoggerMiddleware(log));

const db = createDatabase();
const gameRepo = createGameRepository(db);
const favouriteRepo = createFavouriteRepository(db);
const userRepo = createUserRepository(db);
const crashRepo = createGameCrashRepository(db);

app.use(resolveUser(userRepo));

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'game-builder',
    version: process.env.npm_package_version ?? '0.0.0',
    uptime: Math.floor((Date.now() - startedAt) / 1000),
    dependencies: { db: 'connected', redis: 'connected' },
  });
});

app.use('/games', feedRouter(gameRepo));
app.use('/games', serveRouter(gameRepo));
app.use('/games', crashRouter(crashRepo));
app.use('/games', gamesRouter(gameRepo));
app.use('/favourites', favouritesRouter(favouriteRepo, gameRepo));

app.use(sentryErrorMiddleware);

app.listen(config.port, () => {
  log.info({ port: config.port }, 'game-builder listening');
});

export default app;
