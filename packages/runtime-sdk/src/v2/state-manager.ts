import type { GameState } from '../types.js';

type StateChangeHandler = (from: GameState, to: GameState) => void;

const VALID_TRANSITIONS: Record<GameState, GameState[]> = {
  idle: ['intro'],
  intro: ['playing'],
  playing: ['paused', 'gameover'],
  paused: ['playing', 'gameover'],
  gameover: ['playing', 'intro'],
};

/**
 * Manages the game state machine, enforcing valid transitions and emitting
 * state-change events. Generated games can use this to avoid invalid state
 * bugs (e.g. pausing from idle).
 */
export class GameStateManager {
  private state: GameState = 'idle';
  private listeners: StateChangeHandler[] = [];

  getState(): GameState {
    return this.state;
  }

  /**
   * Attempt a state transition. Returns true if the transition was valid
   * and executed, false if it was rejected.
   */
  transition(to: GameState): boolean {
    const allowed = VALID_TRANSITIONS[this.state];
    if (!allowed?.includes(to)) {
      return false;
    }
    const from = this.state;
    this.state = to;
    for (const fn of this.listeners) {
      fn(from, to);
    }
    return true;
  }

  /**
   * Force-set state without transition validation. Use for restart(),
   * which can transition from ANY state to 'playing'.
   */
  forceState(to: GameState): void {
    const from = this.state;
    this.state = to;
    for (const fn of this.listeners) {
      fn(from, to);
    }
  }

  canTransition(to: GameState): boolean {
    return VALID_TRANSITIONS[this.state]?.includes(to) ?? false;
  }

  onChange(handler: StateChangeHandler): () => void {
    this.listeners.push(handler);
    return () => {
      this.listeners = this.listeners.filter((h) => h !== handler);
    };
  }

  reset(): void {
    this.state = 'idle';
    this.listeners = [];
  }
}
