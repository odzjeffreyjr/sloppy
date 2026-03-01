import type { Request, Response, NextFunction } from 'express';
import { getFirebaseAuth } from './firebase.js';
import type { AuthUser } from './types.js';

function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice(7);
}

/**
 * Verifies the Firebase ID token from the Authorization header and attaches
 * the decoded user to `req.user`. Rejects if no token or token is invalid.
 */
export async function authenticateRequest(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const token = extractBearerToken(req);
  if (!token) {
    res.status(401).json({
      error: 'Missing authentication token',
      code: 'AUTH_TOKEN_MISSING',
      status: 401,
    });
    return;
  }

  try {
    const decoded = await getFirebaseAuth().verifyIdToken(token);

    const user: AuthUser = {
      uid: decoded.uid,
      email: decoded.email ?? '',
      displayName: decoded.name,
      isAnonymous:
        decoded.firebase.sign_in_provider === 'anonymous',
    };

    req.user = user;
    next();
  } catch {
    res.status(401).json({
      error: 'Invalid or expired token',
      code: 'AUTH_TOKEN_INVALID',
      status: 401,
    });
  }
}

/**
 * Gate that rejects unauthenticated and anonymous users.
 * Must be used after `authenticateRequest`.
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (!req.user) {
    res.status(401).json({
      error: 'Authentication required',
      code: 'AUTH_REQUIRED',
      status: 401,
    });
    return;
  }

  if (req.user.isAnonymous) {
    res.status(403).json({
      error: 'Anonymous users cannot perform this action',
      code: 'AUTH_ANONYMOUS_FORBIDDEN',
      status: 403,
    });
    return;
  }

  next();
}

/**
 * Attaches user info to `req.user` when a valid token is present.
 * Proceeds without user if no token or token is invalid (for public routes).
 */
export async function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const token = extractBearerToken(req);
  if (!token) {
    next();
    return;
  }

  try {
    const decoded = await getFirebaseAuth().verifyIdToken(token);

    req.user = {
      uid: decoded.uid,
      email: decoded.email ?? '',
      displayName: decoded.name,
      isAnonymous:
        decoded.firebase.sign_in_provider === 'anonymous',
    };
  } catch {
    // Invalid token — proceed without user
  }

  next();
}
