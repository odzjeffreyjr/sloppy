import type { Request, Response, NextFunction } from 'express';
import { createLogger } from '@sloppy/logger';

const log = createLogger('api-gateway');

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: 'Not Found',
    message: `No route matches ${req.method} ${req.originalUrl}`,
    statusCode: 404,
  });
}

export function errorHandler(
  err: Error & { status?: number; statusCode?: number },
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const status = err.status || err.statusCode || 500;

  const meta = {
    requestId: req.id,
    error: err.message,
    stack: status === 500 ? err.stack : undefined,
    method: req.method,
    path: req.originalUrl,
  };

  if (status >= 500) {
    log.error(meta, 'server error');
  } else {
    log.warn(meta, 'client error');
  }

  res.status(status).json({
    error: status === 500 ? 'Internal Server Error' : err.message,
    message:
      status === 500
        ? 'An unexpected error occurred'
        : err.message,
    statusCode: status,
  });
}
