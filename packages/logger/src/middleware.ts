import type { Request, Response, NextFunction } from 'express';
import type { Logger } from 'pino';

export function requestLoggerMiddleware(logger: Logger) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const start = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - start;
      const meta = {
        requestId: (req as unknown as Record<string, unknown>).id ?? req.headers['x-request-id'],
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        durationMs: duration,
        uid: (req as unknown as { user?: { uid?: string } }).user?.uid,
        contentLength: res.getHeader('content-length'),
      };

      if (res.statusCode >= 500) {
        logger.error(meta, 'request completed with server error');
      } else if (res.statusCode >= 400) {
        logger.warn(meta, 'request completed with client error');
      } else {
        logger.info(meta, 'request completed');
      }
    });

    next();
  };
}
