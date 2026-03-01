/** A request to generate a new game from a natural-language prompt. */
export interface GenerationRequest {
  prompt: string;
  userId: string;
  sessionId?: string;
}

/** Discrete phases of the AI game-generation pipeline. */
export type GenerationPhase = 'concept' | 'code' | 'assets' | 'multiplayer' | 'music';

/** Progress update streamed to the client during game generation. */
export interface GenerationStatus {
  phase: GenerationPhase;
  /** 0–100 progress within the current phase. */
  progress: number;
  message: string;
  error?: string;
}
