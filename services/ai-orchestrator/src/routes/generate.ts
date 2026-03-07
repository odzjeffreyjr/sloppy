import { Router } from 'express';
import { generateId } from '@sloppy/shared';
import { createLogger } from '@sloppy/logger';
import { createDatabase, createUserRepository } from '@sloppy/db';
import { SessionManager } from '../session/manager.js';
import { runPipeline } from '../pipeline/orchestrator.js';

const log = createLogger('ai-orchestrator');

const db = createDatabase();
const userRepo = createUserRepository(db);

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
