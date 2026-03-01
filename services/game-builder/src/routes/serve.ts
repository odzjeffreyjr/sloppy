import { Router } from 'express';
import type { GameRepository } from '@sloppy/db';
import { getBundleUrl, fetchBundleFile } from '../storage/gcs.js';
import { config } from '../config.js';

const CSP_HEADER = [
  "default-src 'none'",
  "script-src 'unsafe-inline' 'unsafe-eval'",
  "style-src 'unsafe-inline'",
  `img-src 'self' data: blob: ${config.cdn.baseUrl}`,
  `media-src 'self' ${config.cdn.baseUrl}`,
  `connect-src 'self'`,
  "font-src 'self' data:",
  "frame-src 'none'",
].join('; ');

export function serveRouter(gameRepo: GameRepository): Router {
  const router = Router();

  // GET /games/:id/bundle — Serve the game's index.html (or redirect to CDN)
  router.get('/:id/bundle', async (req, res) => {
    try {
      const id = req.params.id as string;
      const game = await gameRepo.findById(id);
      if (!game) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Game not found',
          statusCode: 404,
        });
        return;
      }

      if (!game.storagePath) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Game bundle not yet uploaded',
          statusCode: 404,
        });
        return;
      }

      if (req.query.redirect === 'true') {
        const cdnUrl = getBundleUrl(game.storagePath);
        res.redirect(302, cdnUrl);
        return;
      }

      const html = await fetchBundleFile(game.storagePath, 'index.html');

      res.set({
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Security-Policy': CSP_HEADER,
        'Cache-Control': 'public, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'SAMEORIGIN',
      });
      res.send(html);
    } catch (err) {
      console.error('GET /games/:id/bundle error:', err);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to serve game bundle',
        statusCode: 500,
      });
    }
  });

  return router;
}
