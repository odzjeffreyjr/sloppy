import { Router, type Request, type Response } from 'express';
import type { UserRepository } from '@sloppy/db';

export function syncRouter(userRepo: UserRepository): Router {
  const router = Router();

  router.post('/', async (req: Request, res: Response) => {
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

      if (user.isAnonymous) {
        res.status(403).json({
          error: 'Anonymous users cannot sync a profile',
          code: 'AUTH_ANONYMOUS_FORBIDDEN',
          status: 403,
        });
        return;
      }

      const profile = await userRepo.upsertByFirebaseUid({
        firebaseUid: user.uid,
        email: user.email,
        displayName: user.displayName,
      });

      res.json({ data: profile });
    } catch (err) {
      console.error('POST /auth/sync error:', err);
      res.status(500).json({
        error: 'Failed to sync user profile',
        code: 'SYNC_FAILED',
        status: 500,
      });
    }
  });

  return router;
}
