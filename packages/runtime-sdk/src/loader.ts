import type { SloppyGame } from './types.js';

/** Options for the game runtime loader. */
export interface LoaderOptions {
  /** Target FPS for the game loop. Defaults to 60. */
  targetFps?: number;
}

/**
 * Manages the lifecycle of a loaded SloppyGame inside a container element.
 * Handles init, the requestAnimationFrame game loop, and cleanup.
 */
export class GameLoader {
  private game: SloppyGame | null = null;
  private container: HTMLElement | null = null;
  private rafId: number | null = null;
  private lastTimestamp = 0;
  private running = false;
  private readonly targetFrameTime: number;

  constructor(options: LoaderOptions = {}) {
    const fps = options.targetFps ?? 60;
    this.targetFrameTime = 1000 / fps;
  }

  /**
   * Load and initialise a game inside the given container.
   * Call {@link start} afterwards to begin the game loop.
   */
  async load(game: SloppyGame, container: HTMLElement): Promise<void> {
    this.game = game;
    this.container = container;
    await game.init(container);
  }

  /** Start the game loop. No-op if already running or no game loaded. */
  start(): void {
    if (this.running || !this.game) return;
    this.running = true;
    this.lastTimestamp = performance.now();
    this.rafId = requestAnimationFrame((ts) => this.loop(ts));
  }

  /** Pause the game loop without destroying the game. */
  stop(): void {
    this.running = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  /** Stop the loop, call `game.destroy()`, and release references. */
  destroy(): void {
    this.stop();
    this.game?.destroy();
    if (this.container) {
      this.container.innerHTML = '';
    }
    this.game = null;
    this.container = null;
  }

  /** Whether the game loop is currently running. */
  get isRunning(): boolean {
    return this.running;
  }

  /** The currently loaded game, if any. */
  get currentGame(): SloppyGame | null {
    return this.game;
  }

  private loop(timestamp: number): void {
    if (!this.running || !this.game) return;

    const elapsed = timestamp - this.lastTimestamp;

    if (elapsed >= this.targetFrameTime) {
      const deltaTime = elapsed / 1000;
      this.game.update(deltaTime);
      this.lastTimestamp = timestamp - (elapsed % this.targetFrameTime);
    }

    this.rafId = requestAnimationFrame((ts) => this.loop(ts));
  }
}
