import type { Request, Response, NextFunction } from 'express';
import type { UserRepository } from '@sloppy/db';
import { createLogger } from '@sloppy/logger';

const log = createLogger('game-builder');

declare global {
  namespace Express {
    interface Request {
      /** Internal platform user ID (resolved from Firebase UID via gateway headers). */
      userId?: string;
    }
  }
}

/**
 * Middleware that resolves the Firebase UID (forwarded by the API gateway as
 * `x-user-uid`) to the internal platform user ID.
 *
 * On mutation routes the gateway already enforces auth, so we can trust
 * these headers.  For read routes the header may be absent.
 */
export function resolveUser(userRepo: UserRepository) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const firebaseUid = req.headers['x-user-uid'] as string | undefined;
    if (!firebaseUid) {
      next();
      return;
    }

    try {
      const user = await userRepo.findByFirebaseUid(firebaseUid);
      if (user) {
        req.userId = user.id;
      }
    } catch (err) {
      log.error({ error: err }, 'failed to resolve user');
    }

    next();
  };
}

/**
 * Gate that rejects requests without a resolved internal user ID.
 * Use on routes that require an authenticated, synced user.
 */
export function requireUser(req: Request, res: Response, next: NextFunction): void {
  if (!req.userId) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required',
      statusCode: 401,
    });
    return;
  }
  next();
}
