import type { Request, Response, NextFunction } from 'express';

let sentryDsn: string | undefined;
let serviceName = 'unknown';

export function initSentry(dsn: string | undefined, service: string): void {
  sentryDsn = dsn;
  serviceName = service;

  if (!dsn) return;

  process.on('uncaughtException', (err) => {
    captureException(err, { context: 'uncaughtException' });
  });

  process.on('unhandledRejection', (reason) => {
    const err = reason instanceof Error ? reason : new Error(String(reason));
    captureException(err, { context: 'unhandledRejection' });
  });
}

export function captureException(
  err: Error,
  extras?: Record<string, unknown>,
): void {
  if (!sentryDsn) return;

  const payload = {
    exception: {
      values: [
        {
          type: err.name,
          value: err.message,
          stacktrace: err.stack
            ? {
                frames: err.stack
                  .split('\n')
                  .slice(1, 11)
                  .map((line) => ({ filename: line.trim() })),
              }
            : undefined,
        },
      ],
    },
    tags: { service: serviceName },
    extra: extras ?? {},
    platform: 'node',
    timestamp: Date.now() / 1000,
  };

  const { host, projectId, publicKey } = parseDsn(sentryDsn);
  if (!host || !projectId || !publicKey) return;

  const url = `https://${host}/api/${projectId}/store/`;

  fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Sentry-Auth': `Sentry sentry_version=7, sentry_client=sloppy/1.0, sentry_key=${publicKey}`,
    },
    body: JSON.stringify(payload),
  }).catch(() => {});
}

function parseDsn(dsn: string): {
  publicKey: string;
  host: string;
  projectId: string;
} {
  try {
    const url = new URL(dsn);
    return {
      publicKey: url.username,
      host: url.host,
      projectId: url.pathname.replace('/', ''),
    };
  } catch {
    return { publicKey: '', host: '', projectId: '' };
  }
}

export function sentryErrorMiddleware(
  err: Error & { status?: number; statusCode?: number },
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const status = err.status || err.statusCode || 500;

  if (status >= 500) {
    captureException(err, {
      requestId: (req as unknown as Record<string, unknown>).id,
      method: req.method,
      path: req.originalUrl,
      service: serviceName,
      uid: (req as unknown as { user?: { uid?: string } }).user?.uid,
    });
  }

  next(err);
}
