import type { Request, Response, NextFunction } from 'express';
import type { UserRepository } from '@sloppy/db';
import { createLogger } from '@sloppy/logger';

const log = createLogger('payments');

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userEmail?: string;
    }
  }
}

export function resolveUser(userRepo: UserRepository) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const firebaseUid = req.headers['x-user-uid'] as string | undefined;
    const email = req.headers['x-user-email'] as string | undefined;

    if (!firebaseUid) {
      next();
      return;
    }

    if (email) req.userEmail = email;

    try {
      const user = await userRepo.findByFirebaseUid(firebaseUid);
      if (user) {
        req.userId = user.id;
        req.userEmail = user.email;
      }
    } catch (err) {
      log.error({ error: err }, 'Failed to resolve user');
    }

    next();
  };
}

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
