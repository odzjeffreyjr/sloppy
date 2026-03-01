import { Router } from 'express';
import type { GameRepository } from '@sloppy/db';
import { generateSlug } from '@sloppy/shared';
import { createLogger } from '@sloppy/logger';
import { validateBundle, type BundleInput } from '../validation/pipeline.js';
import { uploadBundle, getBundleUrl, type BundleFile } from '../storage/gcs.js';
import { tryRecordPlay } from '../redis.js';
import { requireUser } from '../middleware/user.js';

const log = createLogger('game-builder');

function inferContentType(path: string): string {
  if (path.endsWith('.html')) return 'text/html';
  if (path.endsWith('.js')) return 'application/javascript';
  if (path.endsWith('.json')) return 'application/json';
  if (path.endsWith('.css')) return 'text/css';
  if (path.endsWith('.svg')) return 'image/svg+xml';
  if (path.endsWith('.png')) return 'image/png';
  if (path.endsWith('.jpg') || path.endsWith('.jpeg')) return 'image/jpeg';
  if (path.endsWith('.webp')) return 'image/webp';
  if (path.endsWith('.gif')) return 'image/gif';
  if (path.endsWith('.mp3')) return 'audio/mpeg';
  if (path.endsWith('.ogg')) return 'audio/ogg';
  if (path.endsWith('.wav')) return 'audio/wav';
  return 'application/octet-stream';
}

export function gamesRouter(gameRepo: GameRepository): Router {
  const router = Router();

  // POST /games — Create game (validate + store + save to DB)
  router.post('/', requireUser, async (req, res) => {
    try {
      const { files, title, description } = req.body as {
        files: Record<string, string>;
        title?: string;
        description?: string;
      };

      if (!files || typeof files !== 'object') {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Request body must include a "files" object with file contents',
          statusCode: 400,
        });
        return;
      }

      const validation = validateBundle(files);
      if (!validation.valid) {
        res.status(422).json({
          error: 'Validation Failed',
          message: 'Game bundle failed validation',
          statusCode: 422,
          details: validation.errors,
        });
        return;
      }

      const gameTitle = title || validation.config!.title;
      const gameDescription = description || '';
      const slug = generateSlug(gameTitle);

      const game = await gameRepo.create({
        creatorId: req.userId!,
        title: gameTitle,
        description: gameDescription,
        slug,
        supportsMultiplayer: validation.config!.supportsMultiplayer,
      });

      const bundleFiles: BundleFile[] = Object.entries(files).map(
        ([path, content]) => ({
          path,
          content,
          contentType: inferContentType(path),
        }),
      );

      const storagePath = await uploadBundle(game.id, game.version, bundleFiles);

      const updated = await gameRepo.update(game.id, { storagePath });

      res.status(201).json({ data: updated });
    } catch (err) {
      log.error({ error: err }, 'POST /games error');
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to create game',
        statusCode: 500,
      });
    }
  });

  // GET /games/:id — Get game metadata + serve URL
  router.get('/:id', async (req, res) => {
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

      const bundleUrl = game.storagePath
        ? getBundleUrl(game.storagePath)
        : null;

      res.json({ data: { ...game, bundleUrl } });
    } catch (err) {
      log.error({ error: err }, 'GET /games/:id error');
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to fetch game',
        statusCode: 500,
      });
    }
  });

  // PUT /games/:id — Update game (re-validate, store new version)
  router.put('/:id', requireUser, async (req, res) => {
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

      if (game.creatorId !== req.userId) {
        res.status(403).json({
          error: 'Forbidden',
          message: 'Only the game creator can update this game',
          statusCode: 403,
        });
        return;
      }

      const { files, title, description } = req.body as {
        files?: Record<string, string>;
        title?: string;
        description?: string;
      };

      const updates: Parameters<GameRepository['update']>[1] = {};

      if (files && typeof files === 'object') {
        const validation = validateBundle(files);
        if (!validation.valid) {
          res.status(422).json({
            error: 'Validation Failed',
            message: 'Game bundle failed validation',
            statusCode: 422,
            details: validation.errors,
          });
          return;
        }

        const newVersion = game.version + 1;

        const bundleFiles: BundleFile[] = Object.entries(files).map(
          ([path, content]) => ({
            path,
            content,
            contentType: inferContentType(path),
          }),
        );

        const storagePath = await uploadBundle(game.id, newVersion, bundleFiles);

        updates.version = newVersion;
        updates.storagePath = storagePath;
        updates.supportsMultiplayer = validation.config!.supportsMultiplayer;
      }

      if (title) updates.title = title;
      if (description !== undefined) updates.description = description;

      const updated = await gameRepo.update(game.id, updates);

      res.json({ data: updated });
    } catch (err) {
      log.error({ error: err }, 'PUT /games/:id error');
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to update game',
        statusCode: 500,
      });
    }
  });

  // DELETE /games/:id — Soft-delete (requires ownership)
  router.delete('/:id', requireUser, async (req, res) => {
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

      if (game.creatorId !== req.userId) {
        res.status(403).json({
          error: 'Forbidden',
          message: 'Only the game creator can delete this game',
          statusCode: 403,
        });
        return;
      }

      await gameRepo.delete(game.id);

      res.json({ data: { id: game.id, deleted: true } });
    } catch (err) {
      log.error({ error: err }, 'DELETE /games/:id error');
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to delete game',
        statusCode: 500,
      });
    }
  });

  // POST /games/:id/publish — Change status from draft to published
  router.post('/:id/publish', requireUser, async (req, res) => {
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

      if (game.creatorId !== req.userId) {
        res.status(403).json({
          error: 'Forbidden',
          message: 'Only the game creator can publish this game',
          statusCode: 403,
        });
        return;
      }

      if (game.status === 'published') {
        res.status(409).json({
          error: 'Conflict',
          message: 'Game is already published',
          statusCode: 409,
        });
        return;
      }

      const updated = await gameRepo.update(game.id, { status: 'published' });

      res.json({ data: updated });
    } catch (err) {
      log.error({ error: err }, 'POST /games/:id/publish error');
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to publish game',
        statusCode: 500,
      });
    }
  });

  // POST /games/:id/play — Increment play count (debounced)
  router.post('/:id/play', async (req, res) => {
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

      const userId = req.userId || req.ip || 'anonymous';
      const shouldCount = await tryRecordPlay(userId, game.id);

      if (shouldCount) {
        await gameRepo.incrementPlayCount(game.id);
      }

      res.json({ data: { counted: shouldCount } });
    } catch (err) {
      log.error({ error: err }, 'POST /games/:id/play error');
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to record play',
        statusCode: 500,
      });
    }
  });

  return router;
}
