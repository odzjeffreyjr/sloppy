import { Router } from 'express';
import type { GameRepository, FeedSort, GameProgressRepository, FeedEventRepository } from '@sloppy/db';
import { createLogger } from '@sloppy/logger';
import { requireUser } from '../middleware/user.js';

const log = createLogger('feed-router');
const VALID_SORTS = new Set<string>(['recent', 'popular', 'random']);

export function feedRouter(
  gameRepo: GameRepository,
  progressRepo?: GameProgressRepository,
  feedEventRepo?: FeedEventRepository,
): Router {
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
      log.error({ error: err }, 'GET /games/feed error');
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to fetch feed',
        statusCode: 500,
      });
    }
  });

  // GET /games/feed/algorithm — TikTok-style feed with ranking algorithm
  router.get('/feed/algorithm', async (req, res) => {
    try {
      const { cursor, limit: limitStr } = req.query as {
        cursor?: string;
        limit?: string;
      };

      const limit = Math.min(Math.max(parseInt(limitStr || '10', 10) || 10, 1), 30);

      let trendingIds: string[] = [];
      if (feedEventRepo) {
        try {
          trendingIds = await feedEventRepo.getTrendingGameIds(48, 100);
        } catch {
          // Non-critical — fall back to regular feed
        }
      }

      const page = await gameRepo.getFeed({
        cursor,
        limit,
        sort: trendingIds.length > 0 ? 'popular' : 'recent',
        userId: req.userId,
      });

      // Inject diversity: avoid consecutive same-genre games
      const diversified = diversifyFeed(page.data);

      res.json({
        data: diversified,
        nextCursor: page.nextCursor,
        hasMore: page.hasMore,
      });
    } catch (err) {
      log.error({ error: err }, 'GET /games/feed/algorithm error');
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to fetch algorithmic feed',
        statusCode: 500,
      });
    }
  });

  // POST /games/:id/progress — Save game progress (requires auth)
  router.post('/:id/progress', requireUser, async (req, res) => {
    if (!progressRepo) {
      res.status(501).json({
        error: 'Not Implemented',
        message: 'Progress saving not configured',
        statusCode: 501,
      });
      return;
    }

    try {
      const gameId = req.params.id as string;
      const { progressData, playTimeMs, playCount } = req.body as {
        progressData?: unknown;
        playTimeMs?: number;
        playCount?: number;
      };

      const record = await progressRepo.save(req.userId!, gameId, {
        progressData,
        playTimeMs,
        playCount,
      });

      res.json({ data: record });
    } catch (err) {
      log.error({ error: err }, 'POST /games/:id/progress error');
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to save progress',
        statusCode: 500,
      });
    }
  });

  // GET /games/:id/progress — Get saved game progress
  router.get('/:id/progress', requireUser, async (req, res) => {
    if (!progressRepo) {
      res.status(501).json({
        error: 'Not Implemented',
        message: 'Progress saving not configured',
        statusCode: 501,
      });
      return;
    }

    try {
      const gameId = req.params.id as string;
      const record = await progressRepo.get(req.userId!, gameId);

      res.json({ data: record });
    } catch (err) {
      log.error({ error: err }, 'GET /games/:id/progress error');
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to fetch progress',
        statusCode: 500,
      });
    }
  });

  // POST /games/:id/feed-event — Track feed analytics event
  router.post('/:id/feed-event', async (req, res) => {
    if (!feedEventRepo) {
      res.status(204).end();
      return;
    }

    try {
      const gameId = req.params.id as string;
      const { eventType, durationMs } = req.body as {
        eventType: string;
        durationMs?: number;
      };

      const validTypes = new Set(['view', 'play_start', 'play_time', 'skip', 'favourite']);
      if (!eventType || !validTypes.has(eventType)) {
        res.status(400).json({
          error: 'Bad Request',
          message: `eventType must be one of: ${[...validTypes].join(', ')}`,
          statusCode: 400,
        });
        return;
      }

      await feedEventRepo.create({
        userId: req.userId,
        gameId,
        eventType: eventType as 'view' | 'play_start' | 'play_time' | 'skip' | 'favourite',
        durationMs,
      });

      res.status(204).end();
    } catch (err) {
      log.error({ error: err }, 'POST /games/:id/feed-event error');
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to record feed event',
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
      log.error({ error: err }, 'GET /games/mine error');
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to fetch user games',
        statusCode: 500,
      });
    }
  });

  return router;
}

/** Re-order games to avoid consecutive entries of the same genre. */
function diversifyFeed<T extends { genre?: string | null }>(games: T[]): T[] {
  if (games.length <= 2) return games;

  const result: T[] = [games[0]];
  const remaining = games.slice(1);

  while (remaining.length > 0) {
    const lastGenre = result[result.length - 1].genre;
    const diffIdx = remaining.findIndex((g) => g.genre !== lastGenre);

    if (diffIdx >= 0) {
      result.push(remaining.splice(diffIdx, 1)[0]);
    } else {
      result.push(remaining.shift()!);
    }
  }

  return result;
}
