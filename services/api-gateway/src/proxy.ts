import {
  createProxyMiddleware,
  fixRequestBody,
} from 'http-proxy-middleware';
import type { Request, Response, NextFunction, Express } from 'express';
import type { ClientRequest, IncomingMessage, ServerResponse } from 'node:http';
import { requireAuth } from '@sloppy/auth-middleware';
import { createLogger } from '@sloppy/logger';
import { config } from './config.js';

const log = createLogger('api-gateway');

function addUserHeaders(proxyReq: ClientRequest, req: Request): void {
  if (req.user) {
    proxyReq.setHeader('x-user-uid', req.user.uid);
    proxyReq.setHeader('x-user-email', req.user.email);
    if (req.user.displayName) {
      proxyReq.setHeader('x-user-display-name', req.user.displayName);
    }
    proxyReq.setHeader('x-user-anonymous', String(req.user.isAnonymous));
  }
  if (req.id) {
    proxyReq.setHeader('x-request-id', req.id);
  }
}

function createServiceProxy(target: string, timeout = config.timeouts.default) {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    proxyTimeout: timeout,
    timeout,
    on: {
      proxyReq: (proxyReq, req) => {
        addUserHeaders(proxyReq, req as Request);
        fixRequestBody(proxyReq, req as Request);
      },
      error: (err, _req, res) => {
        log.error({ error: err.message, target }, 'proxy error');
        if ('writeHead' in res && !(res as ServerResponse).headersSent) {
          (res as Response).status(502).json({
            error: 'Bad Gateway',
            message: 'Downstream service unavailable',
            statusCode: 502,
          });
        }
      },
    },
  });
}

function createSseProxy(target: string) {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    proxyTimeout: config.timeouts.generation,
    timeout: config.timeouts.generation,
    on: {
      proxyReq: (proxyReq, req) => {
        addUserHeaders(proxyReq, req as Request);
      },
      proxyRes: (proxyRes) => {
        proxyRes.headers['cache-control'] = 'no-cache';
        proxyRes.headers['x-accel-buffering'] = 'no';
      },
      error: (err, _req, res) => {
        log.error({ error: err.message }, 'SSE proxy error');
        if ('writeHead' in res && !(res as ServerResponse).headersSent) {
          (res as Response).status(502).json({
            error: 'Bad Gateway',
            message: 'Generation service unavailable',
            statusCode: 502,
          });
        }
      },
    },
  });
}

function requireAuthForMutations(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (req.method === 'GET') {
    next();
    return;
  }
  requireAuth(req, res, next);
}

function preservePath(prefix: string) {
  return (req: Request, _res: Response, next: NextFunction) => {
    req.url = prefix + req.url;
    next();
  };
}

export function mountProxyRoutes(
  app: Express,
  generationRateLimit: ReturnType<typeof import('express-rate-limit').default>,
): void {
  const authProxy = createServiceProxy(config.services.auth);
  const gameProxy = createServiceProxy(config.services.gameBuilder);
  const multiplayerProxy = createServiceProxy(config.services.multiplayer);
  const generationProxy = createServiceProxy(
    config.services.aiOrchestrator,
    config.timeouts.generation,
  );
  const sseProxy = createSseProxy(config.services.aiOrchestrator);

  app.use('/auth', preservePath('/auth'), authProxy);

  // Public game POST endpoints (no auth needed) — must be before the
  // catch-all /games proxy.  app.post() keeps req.url intact so no
  // preservePath is needed.
  app.post('/games/:id/play', gameProxy);
  app.post('/games/:id/crash', gameProxy);

  app.use('/games', requireAuthForMutations, preservePath('/games'), gameProxy);

  app.use('/favourites', requireAuth, preservePath('/favourites'), gameProxy);

  // app.get/app.post preserve req.url (unlike app.use which strips the
  // matched prefix), so no preservePath is needed.
  app.get('/generate/:sessionId/status', requireAuth, sseProxy);
  app.post('/generate', requireAuth, generationRateLimit, generationProxy);

  app.use('/multiplayer', requireAuth, preservePath('/multiplayer'), multiplayerProxy);
}
