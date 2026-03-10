import { Router } from 'express';
import type { GameRepository, CreatorSubscriptionRepository, GameVersionRepository } from '@sloppy/db';
import { generateSlug, TIER_LIMITS } from '@sloppy/shared';
import { createLogger } from '@sloppy/logger';
import { validateBundle, type BundleInput } from '../validation/pipeline.js';
import { validateRuntime } from '../validation/runtime-validator.js';
import type { RuntimeValidationResult } from '../validation/runtime-validator.js';
import { uploadBundle, getBundleUrl, uploadScreenshots, uploadThumbnails, type BundleFile } from '../storage/gcs.js';
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

function getTierLimits(isPaid: boolean) {
  return isPaid ? TIER_LIMITS.paid : TIER_LIMITS.free;
}

export function gamesRouter(
  gameRepo: GameRepository,
  subscriptionRepo: CreatorSubscriptionRepository,
  gameVersionRepo: GameVersionRepository,
): Router {
  const router = Router();

  // POST /games/validate — Validate only (no storage, no DB write)
  router.post('/validate', async (req, res) => {
    try {
      const { files } = req.body as { files: Record<string, string> };

      if (!files || typeof files !== 'object') {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Request body must include a "files" object with file contents',
          statusCode: 400,
        });
        return;
      }

      const validation = validateBundle(files);
      const staticErrors = validation.errors;

      let runtimeResult: RuntimeValidationResult | undefined;
      if (validation.isV2) {
        runtimeResult = await validateRuntime(files);
      }

      const runtimeErrors: Array<{ phase: string; message: string }> = [];
      const screenshots: Record<string, string> = {};

      if (runtimeResult) {
        if (runtimeResult.crashedDuring) {
          runtimeErrors.push({
            phase: runtimeResult.crashedDuring,
            message: `Crashed during ${runtimeResult.crashedDuring}`,
          });
        }

        for (const errMsg of runtimeResult.consoleErrors) {
          runtimeErrors.push({ phase: runtimeResult.crashedDuring ?? 'runtime', message: errMsg });
        }

        for (const [state, data] of Object.entries(runtimeResult.states)) {
          if (!data.rendered) {
            runtimeErrors.push({ phase: state, message: `Screen '${state}' did not render` });
          }
          if (data.screenshot) {
            screenshots[state] = data.screenshot.toString('base64');
          }
        }
      }

      const passed =
        staticErrors.length === 0 &&
        (!runtimeResult || runtimeResult.passed);

      res.json({
        passed,
        staticErrors,
        runtimeErrors,
        screenshots,
        isV2: validation.isV2,
      });
    } catch (err) {
      log.error({ error: err }, 'POST /games/validate error');
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Validation failed unexpectedly',
        statusCode: 500,
      });
    }
  });

  // POST /games — Create game (validate + store + save to DB)
  router.post('/', requireUser, async (req, res) => {
    try {
      const { files, title, description, thumbnailBase64, thumbnailSmBase64, skipRuntimeValidation } = req.body as {
        files: Record<string, string>;
        title?: string;
        description?: string;
        thumbnailBase64?: string;
        thumbnailSmBase64?: string;
        skipRuntimeValidation?: boolean;
      };

      if (!files || typeof files !== 'object') {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Request body must include a "files" object with file contents',
          statusCode: 400,
        });
        return;
      }

      // ── Tier limit enforcement ──
      const isPaid = await subscriptionRepo.isActive(req.userId!);
      const limits = getTierLimits(isPaid);

      const gameCount = await gameRepo.countByCreator(req.userId!);
      if (gameCount >= limits.maxGames) {
        res.status(403).json({
          error: 'Game Limit Reached',
          message: `You have reached the maximum of ${limits.maxGames} games. Upgrade to the Creator Plan for unlimited games.`,
          statusCode: 403,
        });
        return;
      }

      if (!isPaid) {
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const recentCount = await gameRepo.countRecentByCreator(req.userId!, weekAgo);
        if (recentCount >= limits.weeklyGameCreations) {
          res.status(403).json({
            error: 'Weekly Limit Reached',
            message: 'Free users can create 1 game per week. Upgrade to the Creator Plan for unlimited games.',
            statusCode: 403,
          });
          return;
        }
      }

      // Static validation (always runs as defense-in-depth)
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

      // Runtime validation for v2 games (skipped when orchestrator already validated)
      let runtimeResult: RuntimeValidationResult | undefined;
      if (validation.isV2 && !skipRuntimeValidation) {
        runtimeResult = await validateRuntime(files);
        if (!runtimeResult.passed) {
          res.status(422).json({
            error: 'Runtime Validation Failed',
            message: 'Game failed runtime validation',
            statusCode: 422,
            details: {
              consoleErrors: runtimeResult.consoleErrors,
              crashedDuring: runtimeResult.crashedDuring,
              states: {
                intro: { rendered: runtimeResult.states.intro.rendered },
                playing: { rendered: runtimeResult.states.playing.rendered },
                paused: { rendered: runtimeResult.states.paused.rendered },
                gameover: { rendered: runtimeResult.states.gameover.rendered },
              },
            },
          });
          return;
        }
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
        genre: validation.config!.genre,
        engine: validation.config!.engine,
      });

      const bundleFiles: BundleFile[] = Object.entries(files).map(
        ([path, content]) => ({
          path,
          content,
          contentType: inferContentType(path),
        }),
      );

      let storagePath: string;
      try {
        storagePath = await uploadBundle(game.id, game.version, bundleFiles);
      } catch (err) {
        log.error({ error: err, gameId: game.id }, 'GCS bundle upload failed — cleaning up DB row');
        await gameRepo.delete(game.id).catch((cleanupErr) =>
          log.error({ error: cleanupErr, gameId: game.id }, 'Failed to clean up DB row after GCS failure'),
        );
        res.status(500).json({
          error: 'Storage Error',
          message: 'Failed to upload game bundle to storage',
          statusCode: 500,
        });
        return;
      }

      const updates: Parameters<GameRepository['update']>[1] = { storagePath };

      // Upload AI-generated thumbnails if provided
      if (thumbnailBase64 && thumbnailSmBase64) {
        try {
          const { thumbnailUrl, thumbnailSmUrl } = await uploadThumbnails(
            game.id,
            game.version,
            {
              thumbnail: Buffer.from(thumbnailBase64, 'base64'),
              thumbnailSm: Buffer.from(thumbnailSmBase64, 'base64'),
            },
          );
          await gameRepo.updateThumbnail(game.id, thumbnailUrl, thumbnailSmUrl);
        } catch (err) {
          log.warn({ error: err, gameId: game.id }, 'Failed to upload AI-generated thumbnails — falling back to screenshots');
        }
      }

      // Upload screenshots and set fallback thumbnail for v2 games (if no AI thumbnail was uploaded)
      if (runtimeResult?.passed) {
        try {
          await uploadScreenshots(game.id, game.version, {
            intro: runtimeResult.states.intro.screenshot,
            playing: runtimeResult.states.playing.screenshot,
            paused: runtimeResult.states.paused.screenshot,
            gameover: runtimeResult.states.gameover.screenshot,
          });

          const thumbFiles: BundleFile[] = Object.entries(runtimeResult.states)
            .filter(([, s]) => s.thumbnail)
            .map(([name, s]) => ({
              path: `screenshots/sm_${name}.png`,
              content: s.thumbnail!,
              contentType: 'image/png',
            }));
          if (thumbFiles.length > 0) {
            await uploadBundle(game.id, game.version, thumbFiles);
          }

          // Only set screenshot-based thumbnail if no AI thumbnail was provided
          if (!thumbnailBase64) {
            const thumbnailUrl = getBundleUrl(storagePath, 'screenshots/playing.png');
            const thumbnailSmUrl = runtimeResult.states.playing.thumbnail
              ? getBundleUrl(storagePath, 'screenshots/sm_playing.png')
              : null;
            await gameRepo.updateThumbnail(game.id, thumbnailUrl, thumbnailSmUrl);
          }
        } catch (err) {
          log.warn({ error: err, gameId: game.id }, 'Failed to upload screenshots — game bundle is still saved');
        }
      }

      const updated = await gameRepo.update(game.id, updates);

      // Record version 1 in version history
      try {
        await gameVersionRepo.create({
          gameId: game.id,
          version: game.version,
          storagePath: storagePath,
          title: gameTitle,
          description: gameDescription,
        });
      } catch (err) {
        log.warn({ error: err, gameId: game.id }, 'Failed to record initial game version');
      }

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

  // GET /games/slug/:slug — Get game by slug
  router.get('/slug/:slug', async (req, res) => {
    try {
      const slug = req.params.slug as string;
      const game = await gameRepo.findBySlug(slug);
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
      log.error({ error: err }, 'GET /games/slug/:slug error');
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to fetch game by slug',
        statusCode: 500,
      });
    }
  });

  // GET /games/quota — Return user's current quota and usage
  router.get('/quota', requireUser, async (req, res) => {
    try {
      const isPaid = await subscriptionRepo.isActive(req.userId!);
      const limits = getTierLimits(isPaid);

      const totalGames = await gameRepo.countByCreator(req.userId!);
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const weeklyCreated = await gameRepo.countRecentByCreator(req.userId!, weekAgo);

      res.json({
        data: {
          totalGames,
          maxGames: limits.maxGames === Infinity ? -1 : limits.maxGames,
          weeklyCreated,
          maxWeeklyGames: limits.weeklyGameCreations === Infinity ? -1 : limits.weeklyGameCreations,
          canPublish: limits.canPublish,
          maxVersionsPerGame: limits.maxVersionsPerGame,
          isPaid,
        },
      });
    } catch (err) {
      log.error({ error: err }, 'GET /games/quota error');
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to fetch quota',
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

      const { files, title, description, thumbnailBase64, thumbnailSmBase64, skipRuntimeValidation } = req.body as {
        files?: Record<string, string>;
        title?: string;
        description?: string;
        thumbnailBase64?: string;
        thumbnailSmBase64?: string;
        skipRuntimeValidation?: boolean;
      };

      // ── Version depth enforcement ──
      if (files && typeof files === 'object') {
        const isPaid = await subscriptionRepo.isActive(req.userId!);
        const limits = getTierLimits(isPaid);
        if (game.version >= limits.maxVersionsPerGame) {
          res.status(403).json({
            error: 'Version Limit Reached',
            message: `This game has reached the maximum of ${limits.maxVersionsPerGame} versions. ${isPaid ? '' : 'Upgrade to the Creator Plan for up to 10 versions per game.'}`.trim(),
            statusCode: 403,
          });
          return;
        }
      }

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

        // Runtime validation for v2 games (skipped when orchestrator already validated)
        let runtimeResult: RuntimeValidationResult | undefined;
        if (validation.isV2 && !skipRuntimeValidation) {
          runtimeResult = await validateRuntime(files);
          if (!runtimeResult.passed) {
            res.status(422).json({
              error: 'Runtime Validation Failed',
              message: 'Game failed runtime validation',
              statusCode: 422,
              details: {
                consoleErrors: runtimeResult.consoleErrors,
                crashedDuring: runtimeResult.crashedDuring,
                states: {
                  intro: { rendered: runtimeResult.states.intro.rendered },
                  playing: { rendered: runtimeResult.states.playing.rendered },
                  paused: { rendered: runtimeResult.states.paused.rendered },
                  gameover: { rendered: runtimeResult.states.gameover.rendered },
                },
              },
            });
            return;
          }
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

        // Upload AI-generated thumbnails if provided
        if (thumbnailBase64 && thumbnailSmBase64) {
          try {
            const { thumbnailUrl, thumbnailSmUrl } = await uploadThumbnails(
              game.id,
              newVersion,
              {
                thumbnail: Buffer.from(thumbnailBase64, 'base64'),
                thumbnailSm: Buffer.from(thumbnailSmBase64, 'base64'),
              },
            );
            await gameRepo.updateThumbnail(game.id, thumbnailUrl, thumbnailSmUrl);
          } catch (err) {
            log.warn({ error: err, gameId: game.id }, 'Failed to upload AI-generated thumbnails — falling back to screenshots');
          }
        }

        // Upload screenshots and update fallback thumbnail for v2 games (if no AI thumbnail)
        if (runtimeResult?.passed) {
          try {
            await uploadScreenshots(game.id, newVersion, {
              intro: runtimeResult.states.intro.screenshot,
              playing: runtimeResult.states.playing.screenshot,
              paused: runtimeResult.states.paused.screenshot,
              gameover: runtimeResult.states.gameover.screenshot,
            });

            if (!thumbnailBase64) {
              const thumbFiles: BundleFile[] = Object.entries(runtimeResult.states)
                .filter(([, s]) => s.thumbnail)
                .map(([name, s]) => ({
                  path: `screenshots/sm_${name}.png`,
                  content: s.thumbnail!,
                  contentType: 'image/png',
                }));
              if (thumbFiles.length > 0) {
                await uploadBundle(game.id, newVersion, thumbFiles);
              }

              const thumbnailUrl = getBundleUrl(storagePath, 'screenshots/playing.png');
              const thumbnailSmUrl = runtimeResult.states.playing.thumbnail
                ? getBundleUrl(storagePath, 'screenshots/sm_playing.png')
                : null;
              await gameRepo.updateThumbnail(game.id, thumbnailUrl, thumbnailSmUrl);
            }
          } catch (err) {
            log.warn({ error: err, gameId: game.id }, 'Failed to upload screenshots — game bundle is still saved');
          }
        }
      }

      if (title) updates.title = title;
      if (description !== undefined) updates.description = description;

      const updated = await gameRepo.update(game.id, updates);

      // Record new version in history + prune if over depth limit
      if (updates.version) {
        try {
          const isPaidForVersion = await subscriptionRepo.isActive(req.userId!);
          const versionLimits = getTierLimits(isPaidForVersion);

          await gameVersionRepo.create({
            gameId: game.id,
            version: updates.version,
            storagePath: updates.storagePath ?? null,
            title: title ?? game.title,
            description: description ?? game.description,
          });

          const versionCount = await gameVersionRepo.countByGameId(game.id);
          if (versionCount > versionLimits.maxVersionsPerGame) {
            await gameVersionRepo.deleteOldest(game.id);
          }
        } catch (err) {
          log.warn({ error: err, gameId: game.id }, 'Failed to record game version');
        }
      }

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

      // ── Paid-only publish enforcement ──
      const isPaid = await subscriptionRepo.isActive(req.userId!);
      if (!isPaid) {
        res.status(403).json({
          error: 'Subscription Required',
          message: 'Upgrade to the Creator Plan to publish games to the feed.',
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
