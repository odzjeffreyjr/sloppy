import { Router } from 'express';
import type { GameRepository } from '@sloppy/db';
import { createLogger } from '@sloppy/logger';
import { generateThumbnail } from '../thumbnails/fal-client.js';
import { composeThumbnail } from '../thumbnails/compositor.js';
import { uploadThumbnails } from '../storage/gcs.js';
import { requireUser } from '../middleware/user.js';

const log = createLogger('game-builder');

export function thumbnailsRouter(gameRepo: GameRepository): Router {
  const router = Router();

  /**
   * POST /thumbnails/generate
   *
   * Generates a marketing-quality thumbnail for a game.
   * Steps: FLUX image generation → Sharp.js post-processing (title, genre badge, vignette).
   * Falls back to screenshot-based thumbnail if FLUX fails.
   *
   * Body: { prompt, title, genre, screenshotBase64?, model? }
   * Returns: { thumbnailBase64, thumbnailSmBase64 }
   */
  router.post('/generate', async (req, res) => {
    try {
      const { prompt, title, genre, screenshotBase64, model } = req.body as {
        prompt: string;
        title: string;
        genre: string;
        screenshotBase64?: string;
        model?: 'schnell' | 'dev';
      };

      if (!prompt || !title || !genre) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'prompt, title, and genre are required',
          statusCode: 400,
        });
        return;
      }

      let baseImage = await generateThumbnail(prompt, {
        model: model || 'schnell',
        referenceImageBase64: screenshotBase64,
      });

      if (!baseImage && screenshotBase64) {
        log.info('FLUX generation failed — using screenshot as thumbnail base');
        baseImage = Buffer.from(screenshotBase64, 'base64');
      }

      if (!baseImage) {
        res.status(502).json({
          error: 'Thumbnail Generation Failed',
          message: 'FLUX generation failed and no screenshot fallback available',
          statusCode: 502,
        });
        return;
      }

      const { thumbnail, thumbnailSm } = await composeThumbnail(baseImage, title, genre);

      res.json({
        thumbnailBase64: thumbnail.toString('base64'),
        thumbnailSmBase64: thumbnailSm.toString('base64'),
      });
    } catch (err) {
      log.error({ error: err }, 'POST /thumbnails/generate error');
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Thumbnail generation failed',
        statusCode: 500,
      });
    }
  });

  /**
   * POST /thumbnails/regenerate/:gameId
   *
   * Regenerates the thumbnail for an existing game.
   * Requires the caller to own the game.
   * Uses the game's title and genre to generate a new FLUX prompt.
   */
  router.post('/regenerate/:gameId', requireUser, async (req, res) => {
    try {
      const { gameId } = req.params;
      const creatorId = req.userId!;

      const game = await gameRepo.findById(gameId);
      if (!game) {
        res.status(404).json({ error: 'NotFound', message: 'Game not found', statusCode: 404 });
        return;
      }

      if (game.creatorId !== creatorId) {
        res.status(403).json({ error: 'Forbidden', message: 'Not your game', statusCode: 403 });
        return;
      }

      const title = game.title;
      const genre = game.genre || 'arcade';
      const prompt = `Video game thumbnail art for "${title}", ${genre} genre. Vibrant colors, dynamic composition, high quality digital art, 16:9 aspect ratio.`;

      let baseImage = await generateThumbnail(prompt, { model: 'dev' });

      if (!baseImage) {
        res.status(502).json({
          error: 'Thumbnail Generation Failed',
          message: 'FLUX generation failed — try again later',
          statusCode: 502,
        });
        return;
      }

      const { thumbnail, thumbnailSm } = await composeThumbnail(baseImage, title, genre);

      const { thumbnailUrl, thumbnailSmUrl } = await uploadThumbnails(
        gameId,
        game.version,
        { thumbnail, thumbnailSm },
      );

      await gameRepo.updateThumbnail(gameId, thumbnailUrl, thumbnailSmUrl);

      log.info({ gameId }, 'Thumbnail regenerated');

      res.json({
        data: { thumbnailUrl, thumbnailSmUrl },
      });
    } catch (err) {
      log.error({ error: err, gameId: req.params.gameId }, 'POST /thumbnails/regenerate error');
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Thumbnail regeneration failed',
        statusCode: 500,
      });
    }
  });

  return router;
}
