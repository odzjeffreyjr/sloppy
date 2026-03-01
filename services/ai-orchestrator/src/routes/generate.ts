import { Router } from 'express';
import { generateId } from '@sloppy/shared';
import { createLogger } from '@sloppy/logger';
import { SessionManager } from '../session/manager.js';
import { runPipeline } from '../pipeline/orchestrator.js';

const log = createLogger('ai-orchestrator');

export function generateRouter(): Router {
  const router = Router();
  const sessionManager = new SessionManager();

  router.post('/', async (req, res) => {
    const userId = req.headers['x-user-uid'] as string | undefined;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized', message: 'Missing user context', statusCode: 401 });
      return;
    }

    const { prompt } = req.body as { prompt?: string };
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      res.status(400).json({ error: 'Bad Request', message: 'prompt is required', statusCode: 400 });
      return;
    }

    if (prompt.length > 1000) {
      res.status(400).json({ error: 'Bad Request', message: 'prompt must be under 1000 characters', statusCode: 400 });
      return;
    }

    const sessionId = generateId();

    try {
      await sessionManager.create(sessionId, userId, prompt.trim());
    } catch (err) {
      log.error({ error: err, userId }, 'failed to create generation session');
      res.status(500).json({ error: 'Internal Server Error', message: 'Failed to start generation', statusCode: 500 });
      return;
    }

    log.info({ sessionId, userId, promptLength: prompt.length }, 'generation started');

    runPipeline(sessionId, userId, prompt.trim()).catch((err) => {
      log.error({ sessionId, error: err }, 'pipeline unhandled error');
    });

    res.status(202).json({ data: { sessionId } });
  });

  return router;
}
