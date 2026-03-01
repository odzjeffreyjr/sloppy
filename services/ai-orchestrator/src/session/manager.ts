import type { GenerationPhase, GenerationStatus } from '@sloppy/shared';
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

    const event: GenerationStatus = { phase, progress, message };
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
    state.currentPhase = 'done';
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

    const event: Record<string, unknown> = {
      phase: 'done',
      progress: 100,
      message: meta?.warning
        ? `Game generated successfully (warning: ${meta.warning})`
        : 'Game generated successfully',
      completed: true,
    };
    if (meta?.gameId) event.gameId = meta.gameId;
    if (meta?.title) event.title = meta.title;
    if (meta?.description) event.description = meta.description;

    await redis.publish(this.channelFor(sessionId), JSON.stringify(event));
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

    const event: GenerationStatus = {
      phase: state.currentPhase,
      progress: state.progress,
      message: 'Generation failed',
      error,
    };
    await redis.publish(this.channelFor(sessionId), JSON.stringify(event));
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
