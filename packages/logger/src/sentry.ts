import * as Sentry from '@sentry/node';
import type { Request, Response, NextFunction } from 'express';

let initialized = false;

export function initSentry(dsn: string | undefined, service: string): void {
  if (!dsn || initialized) return;

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.npm_package_version
      ? `${service}@${process.env.npm_package_version}`
      : undefined,
    serverName: service,
    tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
    integrations: [
      Sentry.httpIntegration(),
    ],
  });

  initialized = true;
}

export function captureException(
  err: Error,
  extras?: Record<string, unknown>,
): void {
  if (!initialized) return;

  Sentry.withScope((scope) => {
    if (extras) {
      for (const [key, value] of Object.entries(extras)) {
        scope.setExtra(key, value);
      }
    }
    Sentry.captureException(err);
  });
}

export function sentryErrorMiddleware(
  err: Error & { status?: number; statusCode?: number },
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const status = err.status || err.statusCode || 500;

  if (status >= 500) {
    Sentry.withScope((scope) => {
      scope.setExtra('method', req.method);
      scope.setExtra('path', req.originalUrl);
      scope.setExtra('requestId', (req as unknown as Record<string, unknown>).id);
      const userId = (req as unknown as { userId?: string }).userId;
      if (userId) scope.setUser({ id: userId });
      Sentry.captureException(err);
    });
  }

  next(err);
}
