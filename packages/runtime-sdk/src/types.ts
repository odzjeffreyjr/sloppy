// ---------------------------------------------------------------------------
// Game Engine & Genre
// ---------------------------------------------------------------------------

/** Supported rendering engines. canvas2d is the implicit engine for v1 games. */
export type GameEngine = 'phaser3' | 'threejs' | 'canvas2d';

/** Genre tags used by the AI orchestrator to select generation strategies. */
export type GameGenre =
  | '2d-platformer'
  | '2d-topdown'
  | '2d-puzzle'
  | '2d-arcade'
  | '2d-shooter'
  | '2d-tower-defense'
  | '2d-endless-runner'
  | '2d-rhythm'
  | '2d-cards'
  | '2d-idle'
  | '2d-custom'
  | '3d-firstperson'
  | '3d-thirdperson'
  | '3d-racing'
  | '3d-puzzle'
  | '3d-flight'
  | '3d-platformer'
  | '3d-custom';

// ---------------------------------------------------------------------------
// Game State Machine
// ---------------------------------------------------------------------------

/** The finite set of states a v2 game can be in. */
export type GameState = 'idle' | 'intro' | 'playing' | 'paused' | 'gameover';

// ---------------------------------------------------------------------------
// Supporting Types
// ---------------------------------------------------------------------------

/** Configuration passed to `init()` so the game knows its viewport. */
export interface GameInitConfig {
  container: HTMLElement;
  width: number;
  height: number;
}

/** Describes a single keyboard / input control for the HUD or intro screen. */
export interface ControlHint {
  /** The key or input (e.g. "WASD", "Space", "Mouse"). */
  key: string;
  /** What the input does (e.g. "Move", "Jump", "Shoot"). */
  action: string;
}

/** Outcome of a game session, surfaced on the game-over screen. */
export interface GameResult {
  score: number;
  level?: number;
  /** Seconds elapsed since the game started. */
  timeElapsed: number;
  customData?: Record<string, unknown>;
}

/** Static metadata attached to every v2 game module. */
export interface GameMetadata {
  title: string;
  genre: GameGenre;
  engine: GameEngine;
  supportsMultiplayer: boolean;
  maxPlayers?: number;
  controls: ControlHint[];
  /** Human-readable estimate, e.g. "2-5 min". */
  estimatedPlayTime: string;
}

/** Multiplayer hooks — required only when `supportsMultiplayer` is true. */
export interface MultiplayerHooks {
  getInitialState(): Record<string, unknown>;
  applyPlayerInput(playerId: string, input: unknown): void;
  updateState(state: Record<string, unknown>): void;
  serializeState(): Record<string, unknown>;
  onPlayerJoin(playerId: string): void;
  onPlayerLeave(playerId: string): void;
}

// ---------------------------------------------------------------------------
// V2 Game Contract
// ---------------------------------------------------------------------------

/**
 * The contract every AI-generated Sloppy v2 game MUST implement.
 *
 * V2 games own their full lifecycle — start screen, pause overlay,
 * game-over screen, and HUD are all rendered by the game itself,
 * eliminating z-index conflicts between the React shell and game iframe.
 */
export interface SloppyGameV2 {
  // -- Lifecycle -------------------------------------------------------------

  /** Initialise the game inside the given container element. Called once. */
  init(container: HTMLElement, config: GameInitConfig): Promise<void>;

  /** Clean up all resources (event listeners, timers, DOM nodes, engines). */
  destroy(): void;

  // -- State Machine ---------------------------------------------------------

  /** Transition: IDLE → INTRO → PLAYING. */
  start(): void;

  /** Transition: PLAYING → PAUSED. */
  pause(): void;

  /** Transition: PAUSED → PLAYING. */
  resume(): void;

  /** Reset all state and transition: ANY → PLAYING. */
  restart(): void;

  // -- Screen Rendering (AI must implement each) -----------------------------

  /** Render the intro / title screen shown before gameplay begins. */
  renderIntroScreen(): void;

  /** Render the pause overlay. */
  renderPauseScreen(): void;

  /** Render the game-over screen with final results. */
  renderGameOverScreen(score: GameResult): void;

  /** Render the in-game heads-up display (score, lives, timer, etc.). */
  renderHUD(): void;

  // -- State Introspection ---------------------------------------------------

  /** Return the current state of the game state machine. */
  getState(): GameState;

  /** Return the current score / result snapshot. */
  getScore(): GameResult;

  // -- Metadata --------------------------------------------------------------

  /** Static metadata describing the game. */
  readonly metadata: GameMetadata;

  // -- Multiplayer -----------------------------------------------------------

  /** Whether this game supports multiplayer sessions. */
  readonly supportsMultiplayer: boolean;

  /** Multiplayer hooks — present only when `supportsMultiplayer` is true. */
  multiplayerHooks?: MultiplayerHooks;
}

// ---------------------------------------------------------------------------
// V2 Game Config (config.json)
// ---------------------------------------------------------------------------

/** Per-game configuration file (`config.json`) for v2 games. */
export interface GameConfig {
  title: string;
  version: string;
  engine: GameEngine;
  genre: GameGenre;
  supportsMultiplayer: boolean;
  maxPlayers?: number;
  controls: ControlHint[];
  resolution: {
    width: number;
    height: number;
    scaleMode: 'fit' | 'fill' | 'stretch';
  };
  assets: string[];
  audio?: string[];
  /** Human-readable estimate, e.g. "2-5 min". */
  estimatedPlayTime?: string;
}

// ---------------------------------------------------------------------------
// V1 Backward Compatibility
// ---------------------------------------------------------------------------

/**
 * @deprecated Use `SloppyGameV2` for new games. Kept for backward compatibility
 * so existing v1 games continue to load.
 */
export interface SloppyGameV1 {
  init(container: HTMLElement): void | Promise<void>;
  update(deltaTime: number): void;
  destroy(): void;
  supportsMultiplayer: boolean;
  getInitialState?(): Record<string, unknown>;
  applyPlayerInput?(playerId: string, input: unknown): void;
  updateState?(state: Record<string, unknown>): void;
  serializeState?(): Record<string, unknown>;
}

/**
 * @deprecated Alias kept so imports of the old name still resolve.
 * Prefer `SloppyGameV2`.
 */
export type SloppyGame = SloppyGameV1;
