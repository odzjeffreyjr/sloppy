import { Router, type Request, type Response } from 'express';
import type { UserRepository, GameRepository } from '@sloppy/db';

export function profileRouter(
  userRepo: UserRepository,
  gameRepo: GameRepository,
): Router {
  const router = Router();

  router.get('/:userId', async (req: Request<{ userId: string }>, res: Response) => {
    try {
      const userId = req.params.userId;
      if (!userId) {
        res.status(400).json({
          error: 'userId parameter is required',
          code: 'BAD_REQUEST',
          status: 400,
        });
        return;
      }

      const user = await userRepo.findById(userId);
      if (!user) {
        res.status(404).json({
          error: 'User not found',
          code: 'USER_NOT_FOUND',
          status: 404,
        });
        return;
      }

      const gamesPage = await gameRepo.findByCreator(userId, undefined, 200);
      const publishedGames = gamesPage.data.filter(
        (g) => g.status === 'published',
      );
      const totalPlayCount = publishedGames.reduce(
        (sum, g) => sum + (g.playCount ?? 0),
        0,
      );

      res.json({
        data: {
          id: user.id,
          displayName: user.displayName ?? 'Anonymous',
          createdAt: user.createdAt,
          gameCount: publishedGames.length,
          totalPlayCount,
        },
      });
    } catch (err) {
      console.error('GET /auth/profile/:userId error:', err);
      res.status(500).json({
        error: 'Failed to fetch profile',
        code: 'PROFILE_FETCH_FAILED',
        status: 500,
      });
    }
  });

  return router;
}
