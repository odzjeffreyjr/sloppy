import { Router, type Request, type Response } from 'express';
import type { UserRepository } from '@sloppy/db';

export function meRouter(userRepo: UserRepository): Router {
  const router = Router();

  router.get('/', async (req: Request, res: Response) => {
    try {
      const { user } = req;
      if (!user) {
        res.status(401).json({
          error: 'Authentication required',
          code: 'AUTH_REQUIRED',
          status: 401,
        });
        return;
      }

      const profile = await userRepo.findByFirebaseUid(user.uid);
      if (!profile) {
        res.status(404).json({
          error: 'User profile not found. Call POST /auth/sync first.',
          code: 'USER_NOT_FOUND',
          status: 404,
        });
        return;
      }

      res.json({ data: profile });
    } catch (err) {
      console.error('GET /auth/me error:', err);
      res.status(500).json({
        error: 'Failed to retrieve user profile',
        code: 'PROFILE_FETCH_FAILED',
        status: 500,
      });
    }
  });

  return router;
}
