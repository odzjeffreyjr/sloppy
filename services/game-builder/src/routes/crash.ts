import { Router } from 'express';
import type { GameCrashRepository } from '@sloppy/db';
import { createLogger } from '@sloppy/logger';

const log = createLogger('game-builder');

export function crashRouter(crashRepo: GameCrashRepository): Router {
  const router = Router();

  router.post('/:id/crash', async (req, res) => {
    try {
      const gameId = req.params.id as string;
      const { errorMessage, stackTrace } = req.body as {
        errorMessage?: string;
        stackTrace?: string;
      };

      if (!errorMessage) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'errorMessage is required',
          statusCode: 400,
        });
        return;
      }

      await crashRepo.create({
        gameId,
        userId: req.userId,
        errorMessage,
        stackTrace,
      });

      log.warn({ gameId, errorMessage, userId: req.userId }, 'game crash reported');

      const flagged = await crashRepo.flagGameIfCrashing(gameId);
      if (flagged) {
        log.error({ gameId }, 'game flagged due to excessive crashes — reverted to draft');
      }

      res.status(201).json({ data: { reported: true } });
    } catch (err) {
      log.error({ error: err }, 'failed to record crash report');
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to record crash',
        statusCode: 500,
      });
    }
  });

  return router;
}
