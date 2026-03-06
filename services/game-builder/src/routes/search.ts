import { Router } from 'express';
import type { GameRepository } from '@sloppy/db';
import { createLogger } from '@sloppy/logger';

const log = createLogger('game-builder');

export function searchRouter(gameRepo: GameRepository): Router {
  const router = Router();

  // GET /games/search — Full-text search with filters
  router.get('/search', async (req, res) => {
    try {
      const {
        q,
        genre,
        engine,
        multiplayer,
        sort = 'popular',
        cursor,
        limit: limitStr,
      } = req.query as {
        q?: string;
        genre?: string;
        engine?: string;
        multiplayer?: string;
        sort?: string;
        cursor?: string;
        limit?: string;
      };

      const limit = Math.min(Math.max(parseInt(limitStr || '20', 10) || 20, 1), 50);

      if (q && q.trim().length > 0) {
        const filters: { genre?: any; engine?: any } = {};
        if (genre) filters.genre = genre;
        if (engine) filters.engine = engine;

        const page = await gameRepo.search(q.trim(), filters, cursor, limit);
        res.json(page);
        return;
      }

      // When a genre filter is set without a search query, use the dedicated repo method
      if (genre) {
        const page = await gameRepo.getByGenre(genre as any, cursor, limit);
        // Post-filter for engine/multiplayer since getByGenre doesn't support those
        if (engine || multiplayer === 'true') {
          page.data = page.data.filter((g: any) => {
            if (engine && g.engine !== engine) return false;
            if (multiplayer === 'true' && !g.supportsMultiplayer) return false;
            return true;
          });
        }
        res.json(page);
        return;
      }

      if (engine) {
        const page = await gameRepo.getByEngine(engine as any, cursor, limit);
        if (multiplayer === 'true') {
          page.data = page.data.filter((g: any) => g.supportsMultiplayer);
        }
        res.json(page);
        return;
      }

      // No filters — return sorted feed
      const feedSort = sort === 'newest' ? 'recent' : 'popular';
      const page = await gameRepo.getFeed({
        cursor,
        limit,
        sort: feedSort as any,
        userId: req.userId,
      });

      if (multiplayer === 'true') {
        page.data = page.data.filter((g: any) => g.supportsMultiplayer);
      }

      res.json(page);
    } catch (err) {
      log.error({ error: err }, 'GET /games/search error');
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Search failed',
        statusCode: 500,
      });
    }
  });

  // GET /games/creator/:creatorId — Public list of a creator's published games
  router.get('/creator/:creatorId', async (req, res) => {
    try {
      const { creatorId } = req.params;
      const { cursor, limit: limitStr } = req.query as {
        cursor?: string;
        limit?: string;
      };

      const limit = Math.min(Math.max(parseInt(limitStr || '20', 10) || 20, 1), 50);
      const page = await gameRepo.findByCreator(creatorId, cursor, limit);

      page.data = page.data.filter((g: any) => g.status === 'published');

      res.json(page);
    } catch (err) {
      log.error({ error: err }, 'GET /games/creator/:creatorId error');
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to fetch creator games',
        statusCode: 500,
      });
    }
  });

  // GET /games/trending — Trending games by engagement in last N hours.
  // Falls back to popular feed when no feed_events data exists yet.
  router.get('/trending', async (req, res) => {
    try {
      const { hours: hoursStr, limit: limitStr } = req.query as {
        hours?: string;
        limit?: string;
      };

      const hours = Math.min(Math.max(parseInt(hoursStr || '24', 10) || 24, 1), 168);
      const limit = Math.min(Math.max(parseInt(limitStr || '10', 10) || 10, 1), 50);

      const trendingGames = await gameRepo.getTrending(hours, limit);

      if (trendingGames.length > 0) {
        // getTrending returns Game[] — augment with display fields
        const data = trendingGames.map((g: any) => ({
          ...g,
          isFavourited: false,
          creatorDisplayName: 'Creator',
        }));
        res.json({ data });
        return;
      }

      // Fallback: if no trending data, return popular games
      const page = await gameRepo.getFeed({
        limit,
        sort: 'popular',
        userId: req.userId,
      });
      res.json({ data: page.data });
    } catch (err) {
      log.error({ error: err }, 'GET /games/trending error');
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to fetch trending games',
        statusCode: 500,
      });
    }
  });

  // GET /games/featured — Top games for hero banner
  router.get('/featured', async (req, res) => {
    try {
      const { limit: limitStr } = req.query as { limit?: string };
      const limit = Math.min(Math.max(parseInt(limitStr || '5', 10) || 5, 1), 10);

      // Featured = top games by play count + favourite count (most engaged)
      const page = await gameRepo.getFeed({
        limit,
        sort: 'popular',
        userId: req.userId,
      });

      res.json({ data: page.data });
    } catch (err) {
      log.error({ error: err }, 'GET /games/featured error');
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to fetch featured games',
        statusCode: 500,
      });
    }
  });

  return router;
}
