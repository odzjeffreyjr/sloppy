import { Router } from 'express';
import type { GameRepository, FeedSort } from '@sloppy/db';
import { requireUser } from '../middleware/user.js';

const VALID_SORTS = new Set<string>(['recent', 'popular', 'random']);

export function feedRouter(gameRepo: GameRepository): Router {
  const router = Router();

  // GET /games/feed — Paginated feed (recent, popular, random)
  router.get('/feed', async (req, res) => {
    try {
      const {
        cursor,
        limit: limitStr,
        sort = 'recent',
        seed,
      } = req.query as {
        cursor?: string;
        limit?: string;
        sort?: string;
        seed?: string;
      };

      if (!VALID_SORTS.has(sort)) {
        res.status(400).json({
          error: 'Bad Request',
          message: `Invalid sort mode. Must be one of: ${[...VALID_SORTS].join(', ')}`,
          statusCode: 400,
        });
        return;
      }

      const limit = Math.min(Math.max(parseInt(limitStr || '20', 10) || 20, 1), 50);

      const page = await gameRepo.getFeed({
        cursor,
        limit,
        sort: sort as FeedSort,
        userId: req.userId,
        seed,
      });

      res.json(page);
    } catch (err) {
      console.error('GET /games/feed error:', err);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to fetch feed',
        statusCode: 500,
      });
    }
  });

  // GET /games/mine — User's own games (drafts + published)
  router.get('/mine', requireUser, async (req, res) => {
    try {
      const { cursor, limit: limitStr } = req.query as {
        cursor?: string;
        limit?: string;
      };

      const limit = Math.min(Math.max(parseInt(limitStr || '20', 10) || 20, 1), 50);

      const page = await gameRepo.findByCreator(req.userId!, cursor, limit);

      res.json(page);
    } catch (err) {
      console.error('GET /games/mine error:', err);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to fetch user games',
        statusCode: 500,
      });
    }
  });

  return router;
}
