import { Router } from 'express';
import { generateId, TIER_LIMITS } from '@sloppy/shared';
import { createLogger } from '@sloppy/logger';
import {
  createDatabase,
  createUserRepository,
  createGameRepository,
  createCreatorSubscriptionRepository,
} from '@sloppy/db';
import { SessionManager } from '../session/manager.js';
import { runPipeline } from '../pipeline/orchestrator.js';

const log = createLogger('ai-orchestrator');

const db = createDatabase();
const userRepo = createUserRepository(db);
const gameRepo = createGameRepository(db);
const subscriptionRepo = createCreatorSubscriptionRepository(db);

export function generateRouter(): Router {
  const router = Router();
  const sessionManager = new SessionManager();

  router.post('/', async (req, res) => {
    const firebaseUid = req.headers['x-user-uid'] as string | undefined;
    if (!firebaseUid) {
      res.status(401).json({ error: 'Unauthorized', message: 'Missing user context', statusCode: 401 });
      return;
    }

    const { prompt, gameId: existingGameId } = req.body as { prompt?: string; gameId?: string };
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      res.status(400).json({ error: 'Bad Request', message: 'prompt is required', statusCode: 400 });
      return;
    }

    if (prompt.length > 1000) {
      res.status(400).json({ error: 'Bad Request', message: 'prompt must be under 1000 characters', statusCode: 400 });
      return;
    }

    let internalUserId: string = firebaseUid;
    try {
      const user = await userRepo.findByFirebaseUid(firebaseUid);
      if (user) {
        internalUserId = user.id;
      } else {
        log.warn({ firebaseUid }, 'no user record found for Firebase UID — generation_logs will use Firebase UID');
      }
    } catch (err) {
      log.warn({ error: err, firebaseUid }, 'failed to resolve internal user ID');
    }

    // ── Tier limit enforcement ──
    try {
      const isPaid = await subscriptionRepo.isActive(internalUserId);
      const limits = isPaid ? TIER_LIMITS.paid : TIER_LIMITS.free;

      if (existingGameId) {
        const game = await gameRepo.findById(existingGameId);
        if (game && game.version >= limits.maxVersionsPerGame) {
          res.status(403).json({
            error: 'Version Limit Reached',
            message: `This game has reached the maximum of ${limits.maxVersionsPerGame} versions. ${isPaid ? '' : 'Upgrade to the Creator Plan for up to 10 versions per game.'}`.trim(),
            statusCode: 403,
          });
          return;
        }
      } else {
        const gameCount = await gameRepo.countByCreator(internalUserId);
        if (gameCount >= limits.maxGames) {
          res.status(403).json({
            error: 'Game Limit Reached',
            message: `You have reached the maximum of ${limits.maxGames} games. Upgrade to the Creator Plan for unlimited games.`,
            statusCode: 403,
          });
          return;
        }

        if (!isPaid) {
          const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          const recentCount = await gameRepo.countRecentByCreator(internalUserId, weekAgo);
          if (recentCount >= limits.weeklyGameCreations) {
            res.status(403).json({
              error: 'Weekly Limit Reached',
              message: 'Free users can create 1 game per week. Upgrade to the Creator Plan for unlimited games.',
              statusCode: 403,
            });
            return;
          }
        }
      }
    } catch (err) {
      log.warn({ error: err, firebaseUid }, 'failed to check tier limits — allowing generation');
    }

    const sessionId = generateId();

    try {
      await sessionManager.create(sessionId, firebaseUid, prompt.trim());
    } catch (err) {
      log.error({ error: err, firebaseUid }, 'failed to create generation session');
      res.status(500).json({ error: 'Internal Server Error', message: 'Failed to start generation', statusCode: 500 });
      return;
    }

    log.info({ sessionId, userId: firebaseUid, promptLength: prompt.length, existingGameId }, 'generation started');

    runPipeline(sessionId, internalUserId, firebaseUid, prompt.trim(), existingGameId).catch((err) => {
      log.error({ sessionId, error: err }, 'pipeline unhandled error');
    });

    res.status(202).json({ data: { sessionId } });
  });

  return router;
}
