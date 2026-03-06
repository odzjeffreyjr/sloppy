import type {
  GenerationPhase,
  GenerationStatus,
  GenerationEvent,
  GenerationGameState,
} from '@sloppy/shared';
import { getRedis } from '../redis.js';
import { config } from '../config.js';
import type { GameBundle } from '../pipeline/types.js';

export interface SessionState {
  sessionId: string;
  userId: string;
  prompt: string;
  status: 'running' | 'completed' | 'failed';
  currentPhase: GenerationPhase;
  progress: number;
  message: string;
  error?: string;
  gameBundle?: GameBundle;
  gameId?: string;
  title?: string;
  description?: string;
  createdAt: number;
}

const KEY_PREFIX = 'generation:';
const CHANNEL_PREFIX = 'generation:updates:';

export class SessionManager {
  private keyFor(sessionId: string): string {
    return `${KEY_PREFIX}${sessionId}`;
  }

  private channelFor(sessionId: string): string {
    return `${CHANNEL_PREFIX}${sessionId}`;
  }

  async create(sessionId: string, userId: string, prompt: string): Promise<void> {
    const redis = getRedis();
    const state: SessionState = {
      sessionId,
      userId,
      prompt,
      status: 'running',
      currentPhase: 'concept',
      progress: 0,
      message: 'Queued',
      createdAt: Date.now(),
    };

    await redis.set(
      this.keyFor(sessionId),
      JSON.stringify(state),
      'EX',
      config.generation.sessionTtlSeconds,
    );
  }

  async get(sessionId: string): Promise<SessionState | null> {
    const redis = getRedis();
    const raw = await redis.get(this.keyFor(sessionId));
    return raw ? (JSON.parse(raw) as SessionState) : null;
  }

  async updateProgress(
    sessionId: string,
    phase: GenerationPhase,
    progress: number,
    message: string,
  ): Promise<void> {
    const redis = getRedis();
    const state = await this.get(sessionId);
    if (!state) return;

    state.currentPhase = phase;
    state.progress = progress;
    state.message = message;

    await redis.set(
      this.keyFor(sessionId),
      JSON.stringify(state),
      'EX',
      config.generation.sessionTtlSeconds,
    );

    const legacyEvent: GenerationStatus = { phase, progress, message };
    await redis.publish(this.channelFor(sessionId), JSON.stringify(legacyEvent));

    const phaseEvent: GenerationEvent = { type: 'phase', phase };
    await redis.publish(this.channelFor(sessionId), JSON.stringify(phaseEvent));

    const progressEvent: GenerationEvent = { type: 'progress', percent: progress, message };
    await redis.publish(this.channelFor(sessionId), JSON.stringify(progressEvent));
  }

  /**
   * Publish a debug-loop iteration event (used in Prompt 7).
   * Streams current attempt number, max attempts, and the error being fixed.
   */
  async publishIteration(
    sessionId: string,
    attempt: number,
    maxAttempts: number,
    error: string,
  ): Promise<void> {
    const redis = getRedis();
    const event: GenerationEvent = { type: 'iteration', attempt, maxAttempts, error };
    await redis.publish(this.channelFor(sessionId), JSON.stringify(event));
  }

  /**
   * Publish a runtime screenshot event (used in Prompt 7).
   * Streams a base64 PNG for a given game state.
   */
  async publishScreenshot(
    sessionId: string,
    state: GenerationGameState,
    imageBase64: string,
  ): Promise<void> {
    const redis = getRedis();
    const event: GenerationEvent = { type: 'screenshot', state, imageBase64 };
    await redis.publish(this.channelFor(sessionId), JSON.stringify(event));
  }

  async complete(
    sessionId: string,
    bundle: GameBundle,
    meta?: { gameId?: string; title?: string; description?: string; warning?: string },
  ): Promise<void> {
    const redis = getRedis();
    const state = await this.get(sessionId);
    if (!state) return;

    state.status = 'completed';
    state.currentPhase = 'building';
    state.progress = 100;
    state.message = 'Game generated successfully';
    state.gameBundle = bundle;
    if (meta?.gameId) state.gameId = meta.gameId;
    if (meta?.title) state.title = meta.title;
    if (meta?.description) state.description = meta.description;

    await redis.set(
      this.keyFor(sessionId),
      JSON.stringify(state),
      'EX',
      config.generation.sessionTtlSeconds,
    );

    if (meta?.gameId) {
      const completeEvent: GenerationEvent = { type: 'complete', gameId: meta.gameId };
      await redis.publish(this.channelFor(sessionId), JSON.stringify(completeEvent));
    }

    const legacyEvent: Record<string, unknown> = {
      phase: 'done',
      progress: 100,
      message: meta?.warning
        ? `Game generated successfully (warning: ${meta.warning})`
        : 'Game generated successfully',
      completed: true,
    };
    if (meta?.gameId) legacyEvent.gameId = meta.gameId;
    if (meta?.title) legacyEvent.title = meta.title;
    if (meta?.description) legacyEvent.description = meta.description;

    await redis.publish(this.channelFor(sessionId), JSON.stringify(legacyEvent));
  }

  async fail(sessionId: string, error: string): Promise<void> {
    const redis = getRedis();
    const state = await this.get(sessionId);
    if (!state) return;

    state.status = 'failed';
    state.error = error;
    state.message = 'Generation failed';

    await redis.set(
      this.keyFor(sessionId),
      JSON.stringify(state),
      'EX',
      config.generation.sessionTtlSeconds,
    );

    const failEvent: GenerationEvent = { type: 'failed', reason: error, attempts: 0 };
    await redis.publish(this.channelFor(sessionId), JSON.stringify(failEvent));

    const legacyEvent: GenerationStatus = {
      phase: state.currentPhase,
      progress: state.progress,
      message: 'Generation failed',
      error,
    };
    await redis.publish(this.channelFor(sessionId), JSON.stringify(legacyEvent));
  }

  async cleanup(sessionId: string): Promise<void> {
    const redis = getRedis();
    await redis.del(this.keyFor(sessionId));
  }

  subscribeToUpdates(
    sessionId: string,
    onMessage: (status: GenerationStatus & { completed?: boolean; gameId?: string; title?: string; description?: string }) => void,
    onError: (err: Error) => void,
  ): () => void {
    const subscriber = getRedis().duplicate();
    const channel = this.channelFor(sessionId);

    subscriber.subscribe(channel).catch(onError);

    subscriber.on('message', (_ch: string, data: string) => {
      try {
        onMessage(JSON.parse(data));
      } catch (err) {
        onError(err instanceof Error ? err : new Error(String(err)));
      }
    });

    subscriber.on('error', onError);

    return () => {
      subscriber.unsubscribe(channel).catch(() => {});
      subscriber.disconnect();
    };
  }
}
