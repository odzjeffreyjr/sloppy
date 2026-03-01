import { Router } from 'express';
import type { FavouriteRepository, GameRepository } from '@sloppy/db';
import { requireUser } from '../middleware/user.js';

export function favouritesRouter(
  favouriteRepo: FavouriteRepository,
  gameRepo: GameRepository,
): Router {
  const router = Router();

  // All favourites routes require auth (enforced at gateway level too)
  router.use(requireUser);

  // POST /favourites/:gameId — Add favourite
  router.post('/:gameId', async (req, res) => {
    try {
      const gameId = req.params.gameId as string;
      const game = await gameRepo.findById(gameId);
      if (!game) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Game not found',
          statusCode: 404,
        });
        return;
      }

      const favourite = await favouriteRepo.add(req.userId!, game.id);

      res.status(201).json({ data: favourite });
    } catch (err) {
      console.error('POST /favourites/:gameId error:', err);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to add favourite',
        statusCode: 500,
      });
    }
  });

  // DELETE /favourites/:gameId — Remove favourite
  router.delete('/:gameId', async (req, res) => {
    try {
      const gameId = req.params.gameId as string;
      const removed = await favouriteRepo.remove(req.userId!, gameId);

      if (!removed) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Favourite not found',
          statusCode: 404,
        });
        return;
      }

      res.json({ data: { gameId, removed: true } });
    } catch (err) {
      console.error('DELETE /favourites/:gameId error:', err);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to remove favourite',
        statusCode: 500,
      });
    }
  });

  // GET /favourites — List user's favourited games (paginated, returns GameFeedItem[])
  router.get('/', async (req, res) => {
    try {
      const { cursor, limit: limitStr } = req.query as {
        cursor?: string;
        limit?: string;
      };

      const limit = Math.min(Math.max(parseInt(limitStr || '20', 10) || 20, 1), 50);

      const page = await gameRepo.getFavouritedGames({
        userId: req.userId!,
        cursor,
        limit,
      });

      res.json(page);
    } catch (err) {
      console.error('GET /favourites error:', err);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to fetch favourites',
        statusCode: 500,
      });
    }
  });

  return router;
}
