import type { GenerationPhase } from '@sloppy/shared';
import { createLogger } from '@sloppy/logger';
import { createDatabase, createGenerationLogRepository } from '@sloppy/db';
import { getLLMClient } from '../llm/index.js';
import { config } from '../config.js';
import { SessionManager } from '../session/manager.js';
import { runConceptPhase } from './concept.js';
import { runCodePhase } from './code.js';
import { runAssetsPhase } from './assets.js';
import { runMultiplayerPhase } from './multiplayer.js';
import { runMusicPhase } from './music.js';
import type { GameBundle, PipelineContext, ProgressCallback } from './types.js';

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

function buildHtml(title: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; background: #000; }
    #game-container { width: 100%; height: 100%; }
  </style>
</head>
<body>
  <div id="game-container"></div>
  <script src="game.js"><\/script>
  <script>
    (async function() {
      const container = document.getElementById('game-container');
      if (window.SloppyGame) {
        await window.SloppyGame.init(container);
      }
    })();
  <\/script>
</body>
</html>`;
}

export async function runPipeline(
  sessionId: string,
  internalUserId: string,
  firebaseUid: string,
  prompt: string,
): Promise<void> {
  const sessionManager = new SessionManager();
  const llm = getLLMClient();
  const pipelineStart = Date.now();

  const model =
    config.llm.provider === 'anthropic'
      ? config.llm.anthropic.model
      : config.llm.provider === 'grok'
        ? config.llm.grok.model
        : config.llm.openai.model;

  const ctx: PipelineContext = {
    sessionId,
    userId: firebaseUid,
    prompt,
    tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
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
      () => reject(new Error('Generation timed out after 2 minutes')),
      config.generation.timeoutMs,
    );
  });

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
        ctx.concept = await runPhaseWithTracking('concept', () =>
          runConceptPhase(ctx, llm, onProgress),
        );

        ctx.gameCode = await runPhaseWithTracking('code', () =>
          runCodePhase(ctx, llm, onProgress),
        );

        ctx.assets = await runPhaseWithTracking('assets', () =>
          runAssetsPhase(ctx, llm, onProgress),
        );

        ctx.gameCode = await runPhaseWithTracking('multiplayer', () =>
          runMultiplayerPhase(ctx, llm, onProgress),
        );

        await runMusicPhase(ctx, onProgress);
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

    // Check daily cost threshold
    try {
      const dailyCost = await generationLogRepo.getDailyCost();
      if (dailyCost >= dailyCostThreshold) {
        log.error(
          { dailyCost, threshold: dailyCostThreshold },
          'CRITICAL: daily AI cost threshold exceeded',
        );
      }
    } catch {
      // Non-fatal — don't block generation for cost checks
    }

    const bundle: GameBundle = {
      html: buildHtml(ctx.concept!.title),
      js: ctx.gameCode!,
      config: {
        title: ctx.concept!.title,
        version: '1.0.0',
        supportsMultiplayer: ctx.concept!.supportsMultiplayer,
        maxPlayers: ctx.concept!.supportsMultiplayer ? 4 : undefined,
        assets: (ctx.assets ?? []).map((a) => a.name),
        audio: [],
      },
      assets: ctx.assets ?? [],
    };

    ctx.bundle = bundle;

    const title = ctx.concept!.title;
    const description = ctx.concept!.description;

    let gameId: string | undefined;
    let warning: string | undefined;

    try {
      const builderFiles: Record<string, string> = {
        'index.html': bundle.html,
        'game.js': bundle.js,
        'config.json': JSON.stringify(bundle.config),
      };

      for (const asset of bundle.assets) {
        builderFiles[`assets/${asset.name}.svg`] = asset.svg;
      }

      const resp = await fetch(`${config.gameBuilderUrl}/games`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-uid': ctx.userId,
        },
        body: JSON.stringify({ files: builderFiles, title, description }),
      });

      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        throw new Error(`game-builder responded ${resp.status}: ${text}`);
      }

      const result = await resp.json() as { id?: string; data?: { id?: string } };
      gameId = result.data?.id ?? result.id;

      log.info({ sessionId, gameId }, 'game persisted via game-builder');
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
      if (attempt < config.generation.maxRetries) {
        log.warn({ phase, attempt: attempt + 1 }, 'retrying phase');
        onProgress(phase, 0, `Retrying ${phase} (attempt ${attempt + 2})…`);
      }
    }
  }

  throw lastError;
}
