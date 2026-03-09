import type { GenerationPhase } from '@sloppy/shared';
import { createLogger } from '@sloppy/logger';
import { createDatabase, createGenerationLogRepository } from '@sloppy/db';
import { getLLMClient } from '../llm/index.js';
import { config } from '../config.js';
import { SessionManager } from '../session/manager.js';
import { runConceptArchitect } from '../agents/concept-architect.js';
import { runTechnicalPlanner } from '../agents/technical-planner.js';
import { runDebugFixer } from '../agents/debug-fixer.js';
import type { ValidationError, RuntimeError } from '../agents/debug-fixer.js';
import { runPolishAgent } from '../agents/polish-agent.js';
import { runCodePhase, extractInlineScript } from './code.js';
import { runAssetsPhase } from './assets.js';
import { runMultiplayerInjector } from '../agents/multiplayer-injector.js';
import { runAudioGenerator } from '../agents/audio-generator.js';
import { runThumbnailPrompter } from '../agents/thumbnail-prompter.js';
import { IterationTracker } from './iteration-tracker.js';
import type {
  GameBundle,
  PipelineContext,
  ProgressCallback,
} from './types.js';
import { gddToGameConcept } from './types.js';

const log = createLogger('ai-orchestrator');

const db = createDatabase();
const generationLogRepo = createGenerationLogRepository(db);

const COST_PER_1K: Record<string, { prompt: number; completion: number }> = {
  'gpt-4o': { prompt: 0.0025, completion: 0.01 },
  'gpt-4o-mini': { prompt: 0.00015, completion: 0.0006 },
  'claude-sonnet-4-20250514': { prompt: 0.003, completion: 0.015 },
  'claude-3-5-sonnet-20241022': { prompt: 0.003, completion: 0.015 },
  'grok-3': { prompt: 0.003, completion: 0.015 },
  'grok-3-mini': { prompt: 0.0003, completion: 0.0005 },
};

function estimateCost(model: string, promptTokens: number, completionTokens: number): number {
  const rates = COST_PER_1K[model] ?? { prompt: 0.003, completion: 0.015 };
  return (promptTokens / 1000) * rates.prompt + (completionTokens / 1000) * rates.completion;
}

const dailyCostThreshold = parseFloat(process.env.DAILY_COST_THRESHOLD ?? '50');

function getModel(): string {
  return config.llm.provider === 'anthropic'
    ? config.llm.anthropic.model
    : config.llm.provider === 'grok'
      ? config.llm.grok.model
      : config.llm.openai.model;
}

// ---------------------------------------------------------------------------
// Validation bridge — calls game-builder's /games/validate endpoint
// ---------------------------------------------------------------------------

interface ValidateResponse {
  passed: boolean;
  staticErrors: ValidationError[];
  runtimeErrors: RuntimeError[];
  screenshots: Record<string, string>;
  isV2: boolean;
}

async function callValidationEndpoint(
  html: string,
  bundleConfig: Record<string, unknown>,
): Promise<ValidateResponse> {
  // v2 code is inline in the HTML — extract it for static validation (validateBundle checks game.js)
  const inlineJs = extractInlineScript(html);
  const files: Record<string, string> = {
    'index.html': html,
    'config.json': JSON.stringify(bundleConfig),
    'game.js': inlineJs,
  };

  const resp = await fetch(`${config.gameBuilderUrl}/games/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ files }),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Validation endpoint returned ${resp.status}: ${text}`);
  }

  return resp.json() as Promise<ValidateResponse>;
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

/**
 * V2 multi-agent pipeline:
 *
 *  1. Concept Architect → GDD
 *  2. Technical Planner → TechnicalSpec
 *  3. Code Generator → full HTML with engine CDN
 *  4. Asset Generation (SVG assets)
 *  5. Validation + Debug Loop (max 5 iterations)
 *  6. Polish Pass (on passing build)
 *  7. Audio Generation + Thumbnail Generation (run in parallel)
 *  8. Multiplayer Injection — only when GDD marks multiplayer as suitable
 *  9. Final Build → Deploy
 */
export async function runPipeline(
  sessionId: string,
  internalUserId: string,
  firebaseUid: string,
  prompt: string,
  existingGameId?: string,
): Promise<void> {
  const sessionManager = new SessionManager();
  const llm = getLLMClient();
  const pipelineStart = Date.now();
  const model = getModel();

  async function checkCancelled(): Promise<boolean> {
    const cancelled = await sessionManager.isCancelled(sessionId);
    if (cancelled) {
      log.info({ sessionId }, 'generation cancelled by user — stopping pipeline');
    }
    return cancelled;
  }

  const ctx: PipelineContext = {
    sessionId,
    userId: firebaseUid,
    prompt,
    tokenUsage: {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      byPhase: {},
    },
  };

  const onProgress: ProgressCallback = (
    phase: GenerationPhase,
    progress: number,
    message: string,
  ) => {
    sessionManager
      .updateProgress(sessionId, phase, progress, message)
      .catch((err) => log.error({ error: err }, 'failed to publish progress'));
  };

  let timeoutHandle: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(
      () => reject(new Error(`Generation timed out after ${config.generation.timeoutMs / 1000}s`)),
      config.generation.timeoutMs,
    );
  });

  function trackTokens(
    phase: string,
    usage: { promptTokens: number; completionTokens: number; totalTokens: number },
  ): void {
    ctx.tokenUsage.promptTokens += usage.promptTokens;
    ctx.tokenUsage.completionTokens += usage.completionTokens;
    ctx.tokenUsage.totalTokens += usage.totalTokens;
    ctx.tokenUsage.byPhase[phase] = {
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
    };
  }

  async function runPhaseWithTracking<T>(
    phase: GenerationPhase,
    fn: () => Promise<T>,
  ): Promise<T> {
    const phaseStart = Date.now();
    const beforeTokens = { ...ctx.tokenUsage };

    try {
      const result = await withRetry(fn, phase, onProgress);
      const durationMs = Date.now() - phaseStart;
      const phasePromptTokens = ctx.tokenUsage.promptTokens - beforeTokens.promptTokens;
      const phaseCompletionTokens = ctx.tokenUsage.completionTokens - beforeTokens.completionTokens;
      const cost = estimateCost(model, phasePromptTokens, phaseCompletionTokens);

      log.info(
        { sessionId, phase, durationMs, phasePromptTokens, phaseCompletionTokens, cost },
        'phase completed',
      );

      generationLogRepo.create({
        userId: internalUserId,
        model,
        phase,
        promptTokens: phasePromptTokens,
        completionTokens: phaseCompletionTokens,
        totalCost: cost,
        durationMs,
        status: 'success',
      }).catch((err) => log.error({ error: err }, 'failed to log generation'));

      return result;
    } catch (err) {
      const durationMs = Date.now() - phaseStart;
      const message = err instanceof Error ? err.message : String(err);

      generationLogRepo.create({
        userId: internalUserId,
        model,
        phase,
        promptTokens: ctx.tokenUsage.promptTokens - beforeTokens.promptTokens,
        completionTokens: ctx.tokenUsage.completionTokens - beforeTokens.completionTokens,
        totalCost: 0,
        durationMs,
        status: 'error',
        error: message,
      }).catch((logErr) => log.error({ error: logErr }, 'failed to log generation error'));

      throw err;
    }
  }

  try {
    await sessionManager.updateProgress(sessionId, 'concept', 0, 'Starting generation…');

    await Promise.race([
      (async () => {
        // Phase 1: Concept Architect → GDD
        await runPhaseWithTracking('concept', async () => {
          const { gdd, usage } = await runConceptArchitect(
            ctx.prompt, llm, onProgress, config.generation.maxTokens.concept,
          );
          ctx.gdd = gdd;
          ctx.concept = gddToGameConcept(gdd);
          trackTokens('concept', usage);
          return gdd;
        });

        if (await checkCancelled()) return;

        // Phase 2: Technical Planner → TechnicalSpec
        await runPhaseWithTracking('planning', async () => {
          const { spec, usage } = await runTechnicalPlanner(
            ctx.gdd!, llm, onProgress, config.generation.maxTokens.planning,
          );
          ctx.spec = spec;
          trackTokens('planning', usage);
          return spec;
        });

        if (await checkCancelled()) return;

        // Phase 3: Code Generation → full self-contained HTML with engine CDN
        ctx.gameCode = await runPhaseWithTracking('coding', () =>
          runCodePhase(ctx, llm, onProgress),
        );

        if (await checkCancelled()) return;

        // Phase 4: Asset Generation (folded into coding phase — will be refactored)
        ctx.assets = await runAssetsPhase(ctx, llm, onProgress);

        if (await checkCancelled()) return;

        // Phase 5: Validation + Debug Loop (max 5 iterations)
        const tracker = new IterationTracker(config.generation.maxDebugIterations);
        const gdd = ctx.gdd!;
        const spec = ctx.spec!;

        const bundleConfig = {
          title: gdd.title,
          version: '1.0.0',
          engine: gdd.engine,
          genre: gdd.genre,
          supportsMultiplayer: gdd.multiplayer.suitable,
          maxPlayers: gdd.multiplayer.suitable ? (gdd.multiplayer.maxPlayers ?? 4) : undefined,
          assets: (ctx.assets ?? []).map((a) => a.name),
          audio: [],
        };

        onProgress('validating', 0, 'Validating game…');

        let debugLoopCode = ctx.gameCode!;

        while (true) {
          let validationResult: ValidateResponse;
          try {
            validationResult = await callValidationEndpoint(debugLoopCode, bundleConfig);
          } catch (err) {
            log.warn({ error: err }, 'Validation endpoint call failed — skipping debug loop');
            break;
          }

          // Publish screenshots from this validation run
          for (const [state, b64] of Object.entries(validationResult.screenshots)) {
            sessionManager
              .publishScreenshot(sessionId, state as any, b64)
              .catch((err) => log.error({ error: err }, 'failed to publish screenshot'));
          }

          // Store screenshots from this validation run for thumbnail generation
          ctx.lastValidationScreenshots = validationResult.screenshots;

          if (validationResult.passed) {
            tracker.markPassed();
            onProgress('validating', 100, 'Validation passed');
            log.info({ sessionId, iterations: tracker.currentIteration }, 'Game passed validation');
            break;
          }

          tracker.recordIteration(
            validationResult.staticErrors,
            validationResult.runtimeErrors,
          );

          const errorSummary = tracker.getErrorSummary();

          sessionManager
            .publishIteration(sessionId, tracker.currentIteration, tracker.maxIterations, errorSummary)
            .catch((err) => log.error({ error: err }, 'failed to publish iteration'));

          log.info(
            {
              sessionId,
              iteration: tracker.currentIteration,
              maxIterations: tracker.maxIterations,
              staticErrors: validationResult.staticErrors.length,
              runtimeErrors: validationResult.runtimeErrors.length,
            },
            `Debug iteration ${tracker.currentIteration}/${tracker.maxIterations}`,
          );

          if (!tracker.hasMoreAttempts()) {
            log.error(
              { sessionId, iterations: tracker.currentIteration },
              'Max debug iterations reached — game failed validation',
            );
            break;
          }

          // Run debug fixer
          onProgress('fixing', 0, `Fixing errors (attempt ${tracker.currentIteration})…`);

          const fixResult = await runDebugFixer(
            {
              gdd,
              spec,
              currentCode: debugLoopCode,
              validationErrors: validationResult.staticErrors,
              runtimeErrors: validationResult.runtimeErrors,
              screenshots: validationResult.screenshots,
              iterationCount: tracker.currentIteration,
            },
            llm,
            onProgress,
            config.generation.maxTokens.fix,
          );

          trackTokens(`fixing_${tracker.currentIteration}`, fixResult.usage);

          generationLogRepo.create({
            userId: internalUserId,
            model,
            phase: 'fixing',
            promptTokens: fixResult.usage.promptTokens,
            completionTokens: fixResult.usage.completionTokens,
            totalCost: estimateCost(model, fixResult.usage.promptTokens, fixResult.usage.completionTokens),
            durationMs: 0,
            status: 'success',
          }).catch((err) => log.error({ error: err }, 'failed to log fix iteration'));

          debugLoopCode = fixResult.code;
        }

        if (!tracker.passed) {
          const failEvent = {
            type: 'failed' as const,
            reason: `Game failed validation after ${tracker.currentIteration} attempts: ${tracker.getErrorSummary()}`,
            attempts: tracker.currentIteration,
          };
          await sessionManager.fail(sessionId, failEvent.reason);
          return;
        }

        ctx.gameCode = debugLoopCode;

        if (await checkCancelled()) return;

        // Phase 6: Polish Pass (only on passing builds)
        if (config.generation.enablePolish) {
          onProgress('polishing', 0, 'Polishing visuals…');
          const polishResult = await runPolishAgent(
            ctx.gameCode!,
            gdd,
            llm,
            onProgress,
            config.generation.maxTokens.polish,
          );
          trackTokens('polishing', polishResult.usage);
          ctx.gameCode = polishResult.code;

          generationLogRepo.create({
            userId: internalUserId,
            model,
            phase: 'polishing',
            promptTokens: polishResult.usage.promptTokens,
            completionTokens: polishResult.usage.completionTokens,
            totalCost: estimateCost(model, polishResult.usage.promptTokens, polishResult.usage.completionTokens),
            durationMs: 0,
            status: 'success',
          }).catch((err) => log.error({ error: err }, 'failed to log polish'));
        }

        if (await checkCancelled()) return;

        // Phase 7: Audio Generation + Thumbnail Generation (run in parallel)
        const audioPromise = runPhaseWithTracking('audio', async () => {
          onProgress('audio', 0, 'Injecting sound effects…');

          const audioResult = await runAudioGenerator(
            ctx.gameCode!,
            gdd,
            'zzfx',
            llm,
            onProgress,
            config.generation.maxTokens.audio,
          );

          trackTokens('audio', audioResult.usage);

          generationLogRepo.create({
            userId: internalUserId,
            model,
            phase: 'audio',
            promptTokens: audioResult.usage.promptTokens,
            completionTokens: audioResult.usage.completionTokens,
            totalCost: estimateCost(model, audioResult.usage.promptTokens, audioResult.usage.completionTokens),
            durationMs: 0,
            status: 'success',
          }).catch((err) => log.error({ error: err }, 'failed to log audio generation'));

          ctx.gameCode = audioResult.code;

          if (audioResult.audioFiles?.length) {
            ctx.audioFiles = audioResult.audioFiles;
          }
        });

        const thumbnailPromise = (async () => {
          try {
            onProgress('thumbnail', 0, 'Generating thumbnail…');

            // Step 1: Generate FLUX prompt via LLM
            const { prompt: fluxPrompt, usage: promptUsage } = await runThumbnailPrompter(
              gdd,
              llm,
              onProgress,
              500,
            );
            trackTokens('thumbnail_prompt', promptUsage);

            generationLogRepo.create({
              userId: internalUserId,
              model,
              phase: 'thumbnail',
              promptTokens: promptUsage.promptTokens,
              completionTokens: promptUsage.completionTokens,
              totalCost: estimateCost(model, promptUsage.promptTokens, promptUsage.completionTokens),
              durationMs: 0,
              status: 'success',
            }).catch((err) => log.error({ error: err }, 'failed to log thumbnail prompt'));

            // Step 2: Call game-builder thumbnail endpoint
            onProgress('thumbnail', 40, 'Generating thumbnail image…');

            const playingScreenshot = ctx.lastValidationScreenshots?.playing;

            const thumbResp = await fetch(`${config.gameBuilderUrl}/thumbnails/generate`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                prompt: fluxPrompt,
                title: gdd.title,
                genre: gdd.genre,
                screenshotBase64: playingScreenshot,
                model: 'schnell',
              }),
            });

            if (!thumbResp.ok) {
              const text = await thumbResp.text().catch(() => '');
              log.warn({ status: thumbResp.status, body: text }, 'Thumbnail generation endpoint failed');
              onProgress('thumbnail', 100, 'Thumbnail generation failed — using screenshot fallback');
              return;
            }

            const thumbResult = (await thumbResp.json()) as {
              thumbnailBase64: string;
              thumbnailSmBase64: string;
            };

            ctx.thumbnailBuffer = Buffer.from(thumbResult.thumbnailBase64, 'base64');
            ctx.thumbnailSmBuffer = Buffer.from(thumbResult.thumbnailSmBase64, 'base64');

            log.info({ sessionId, title: gdd.title }, 'Thumbnail generated successfully');
            onProgress('thumbnail', 100, 'Thumbnail ready');
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            log.warn({ sessionId, error: message }, 'Thumbnail generation failed — non-blocking');
            onProgress('thumbnail', 100, 'Thumbnail generation skipped');
          }
        })();

        await Promise.all([audioPromise, thumbnailPromise]);

        if (await checkCancelled()) return;

        // Phase 8: Multiplayer Injection (Prompt 9 — dedicated injector agent)
        if (gdd.multiplayer.suitable) {
          const preMultiplayerCode = ctx.gameCode!;

          await runPhaseWithTracking('multiplayer', async () => {
            onProgress('multiplayer', 0, 'Injecting multiplayer hooks…');

            const mpResult = await runMultiplayerInjector(
              ctx.gameCode!,
              gdd,
              llm,
              onProgress,
              config.generation.maxTokens.multiplayer,
            );

            trackTokens('multiplayer', mpResult.usage);

            generationLogRepo.create({
              userId: internalUserId,
              model,
              phase: 'multiplayer',
              promptTokens: mpResult.usage.promptTokens,
              completionTokens: mpResult.usage.completionTokens,
              totalCost: estimateCost(model, mpResult.usage.promptTokens, mpResult.usage.completionTokens),
              durationMs: 0,
              status: 'success',
            }).catch((err) => log.error({ error: err }, 'failed to log multiplayer injection'));

            ctx.gameCode = mpResult.code;

            // Re-validate after injection to ensure multiplayer hooks don't break the game
            try {
              const mpValidation = await callValidationEndpoint(ctx.gameCode, bundleConfig);
              if (!mpValidation.passed) {
                log.warn(
                  { staticErrors: mpValidation.staticErrors.length, runtimeErrors: mpValidation.runtimeErrors.length },
                  'Multiplayer injection broke validation — reverting to single-player',
                );
                ctx.gameCode = preMultiplayerCode;
                onProgress('multiplayer', 100, 'Multiplayer injection failed validation — using single-player');
              } else {
                onProgress('multiplayer', 100, 'Multiplayer hooks added and validated');
              }
            } catch (err) {
              log.warn({ error: err }, 'Post-multiplayer validation call failed — keeping injected code');
              onProgress('multiplayer', 100, 'Multiplayer hooks added (validation skipped)');
            }
          });
        } else {
          onProgress('multiplayer', 100, 'Skipped — single-player game');
        }

        // Phase 9: Final Build → Deploy
      })(),
      timeout,
    ]);

    clearTimeout(timeoutHandle!);

    const totalDuration = Date.now() - pipelineStart;
    const totalCost = estimateCost(
      model,
      ctx.tokenUsage.promptTokens,
      ctx.tokenUsage.completionTokens,
    );

    log.info(
      {
        sessionId,
        totalDuration,
        totalCost,
        promptTokens: ctx.tokenUsage.promptTokens,
        completionTokens: ctx.tokenUsage.completionTokens,
        model,
      },
      'generation completed',
    );

    try {
      const dailyCost = await generationLogRepo.getDailyCost();
      if (dailyCost >= dailyCostThreshold) {
        log.error(
          { dailyCost, threshold: dailyCostThreshold },
          'CRITICAL: daily AI cost threshold exceeded',
        );
      }
    } catch {
      // Non-fatal
    }

    if (await checkCancelled()) return;

    const bundle: GameBundle = {
      html: ctx.gameCode!,
      js: '',
      config: {
        title: ctx.gdd!.title,
        version: '1.0.0',
        engine: ctx.gdd!.engine,
        genre: ctx.gdd!.genre,
        supportsMultiplayer: ctx.gdd!.multiplayer.suitable,
        maxPlayers: ctx.gdd!.multiplayer.suitable
          ? (ctx.gdd!.multiplayer.maxPlayers ?? 4)
          : undefined,
        assets: (ctx.assets ?? []).map((a) => a.name),
        audio: (ctx.audioFiles ?? []).map((a) => a.name),
      },
      assets: ctx.assets ?? [],
    };

    ctx.bundle = bundle;

    const title = ctx.gdd!.title;
    const description = ctx.gdd!.logline;

    let gameId: string | undefined;
    let warning: string | undefined;

    try {
      const builderFiles: Record<string, string> = {
        'index.html': bundle.html,
        'config.json': JSON.stringify(bundle.config),
      };

      for (const asset of bundle.assets) {
        builderFiles[`assets/${asset.name}.svg`] = asset.svg;
      }

      const gameBuilderPayload: Record<string, unknown> = {
        files: builderFiles,
        title,
        description,
      };

      if (ctx.thumbnailBuffer && ctx.thumbnailSmBuffer) {
        gameBuilderPayload.thumbnailBase64 = ctx.thumbnailBuffer.toString('base64');
        gameBuilderPayload.thumbnailSmBase64 = ctx.thumbnailSmBuffer.toString('base64');
      }

      const isUpdate = !!existingGameId;
      const url = isUpdate
        ? `${config.gameBuilderUrl}/games/${existingGameId}`
        : `${config.gameBuilderUrl}/games`;

      const resp = await fetch(url, {
        method: isUpdate ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-uid': ctx.userId,
        },
        body: JSON.stringify(gameBuilderPayload),
      });

      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        throw new Error(`game-builder responded ${resp.status}: ${text}`);
      }

      const result = await resp.json() as { id?: string; data?: { id?: string } };
      gameId = result.data?.id ?? result.id ?? existingGameId;

      log.info({ sessionId, gameId, isUpdate }, 'game persisted via game-builder');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log.error({ sessionId, error: message }, 'game-builder handoff failed');
      warning = 'Game was generated but could not be saved';
    }

    await sessionManager.complete(sessionId, bundle, { gameId, title, description, warning });
  } catch (err) {
    clearTimeout(timeoutHandle!);
    const message = err instanceof Error ? err.message : 'Unknown error';
    log.error({ sessionId, error: message }, 'generation failed');
    await sessionManager.fail(sessionId, message);
  }
}

async function withRetry<T>(
  fn: () => Promise<T>,
  phase: GenerationPhase,
  onProgress: ProgressCallback,
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= config.generation.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      log.error(
        { phase, attempt: attempt + 1, error: lastError.message },
        'phase attempt failed',
      );
      if (attempt < config.generation.maxRetries) {
        log.warn({ phase, attempt: attempt + 1 }, 'retrying phase');
        onProgress(phase, 0, `Retrying ${phase} (attempt ${attempt + 2})…`);
      }
    }
  }

  throw lastError;
}
