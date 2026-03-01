/**
 * The contract every AI-generated Sloppy game MUST implement.
 * The platform validates, loads, and runs games through this interface.
 */
export interface SloppyGame {
  /**
   * Initialise the game inside the given container element.
   * Called once when the game is first loaded.
   */
  init(container: HTMLElement): void | Promise<void>;

  /**
   * Advance the game by one frame.
   * @param deltaTime — seconds since the last update call.
   */
  update(deltaTime: number): void;

  /** Clean up all resources (event listeners, timers, DOM nodes). */
  destroy(): void;

  /** Whether this game supports multiplayer sessions. */
  supportsMultiplayer: boolean;

  // -- Multiplayer hooks (required only when supportsMultiplayer is true) --

  /** Return the initial authoritative game state. */
  getInitialState?(): Record<string, unknown>;

  /** Apply a player's input to the current state. */
  applyPlayerInput?(playerId: string, input: unknown): void;

  /** Receive an authoritative state snapshot from the server. */
  updateState?(state: Record<string, unknown>): void;

  /** Serialize the current state for transmission. */
  serializeState?(): Record<string, unknown>;
}

/** Per-game configuration file (`config.json`). */
export interface GameConfig {
  title: string;
  version: string;
  supportsMultiplayer: boolean;
  maxPlayers?: number;
  assets: string[];
  audio?: string[];
}
