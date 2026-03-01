/** Status of a multiplayer session. */
export type SessionStatus = 'waiting' | 'active' | 'closed';

/** A multiplayer game session. */
export interface MultiplayerSession {
  id: string;
  gameId: string;
  hostId: string;
  status: SessionStatus;
  playerCount: number;
  maxPlayers: number;
  createdAt: Date;
}

/**
 * Per-player state synchronised across the multiplayer session.
 * Core fields are required; games can extend with arbitrary keys.
 */
export interface PlayerState {
  id: string;
  x: number;
  y: number;
  velocity: number;
  health: number;
  score: number;
  [key: string]: unknown;
}
