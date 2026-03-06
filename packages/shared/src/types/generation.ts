/** A request to generate a new game from a natural-language prompt. */
export interface GenerationRequest {
  prompt: string;
  userId: string;
  sessionId?: string;
}

/**
 * Discrete phases of the v2 AI game-generation pipeline.
 *
 * Added for v2: `planning`, `validating`, `fixing`, `polishing`, `audio`, `thumbnail`.
 * Renamed: `code` → `coding`.
 */
export type GenerationPhase =
  | 'concept'
  | 'planning'
  | 'coding'
  | 'validating'
  | 'fixing'
  | 'polishing'
  | 'multiplayer'
  | 'audio'
  | 'thumbnail'
  | 'building';

/** Finite game states referenced in generation events (mirrors runtime GameState). */
export type GenerationGameState = 'idle' | 'intro' | 'playing' | 'paused' | 'gameover';

/**
 * Rich SSE events streamed to the client during game generation.
 * Replaces the simpler `GenerationStatus` for v2.
 */
export type GenerationEvent =
  | { type: 'phase'; phase: GenerationPhase }
  | { type: 'progress'; percent: number; message: string }
  | { type: 'iteration'; attempt: number; maxAttempts: number; error: string }
  | { type: 'screenshot'; state: GenerationGameState; imageBase64: string }
  | { type: 'complete'; gameId: string }
  | { type: 'failed'; reason: string; attempts: number };

/**
 * @deprecated v1 progress update. Use `GenerationEvent` for v2.
 */
export interface GenerationStatus {
  phase: GenerationPhase;
  /** 0–100 progress within the current phase. */
  progress: number;
  message: string;
  error?: string;
}
