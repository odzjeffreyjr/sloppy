import type { ValidationError, RuntimeError } from '../agents/debug-fixer.js';

export interface IterationRecord {
  attempt: number;
  validationErrors: ValidationError[];
  runtimeErrors: RuntimeError[];
  timestamp: number;
}

export class IterationTracker {
  private readonly _maxIterations: number;
  private readonly _history: IterationRecord[] = [];
  private _passed = false;

  constructor(maxIterations = 5) {
    this._maxIterations = maxIterations;
  }

  get maxIterations(): number {
    return this._maxIterations;
  }

  get currentIteration(): number {
    return this._history.length;
  }

  get passed(): boolean {
    return this._passed;
  }

  recordIteration(
    validationErrors: ValidationError[],
    runtimeErrors: RuntimeError[],
  ): void {
    this._history.push({
      attempt: this._history.length + 1,
      validationErrors,
      runtimeErrors,
      timestamp: Date.now(),
    });
  }

  hasMoreAttempts(): boolean {
    return !this._passed && this._history.length < this._maxIterations;
  }

  markPassed(): void {
    this._passed = true;
  }

  getHistory(): readonly IterationRecord[] {
    return this._history;
  }

  getLastErrors(): { validationErrors: ValidationError[]; runtimeErrors: RuntimeError[] } {
    const last = this._history[this._history.length - 1];
    if (!last) {
      return { validationErrors: [], runtimeErrors: [] };
    }
    return {
      validationErrors: last.validationErrors,
      runtimeErrors: last.runtimeErrors,
    };
  }

  getErrorSummary(): string {
    const last = this._history[this._history.length - 1];
    if (!last) return 'No errors recorded';

    const all = [
      ...last.validationErrors.map((e) => e.message),
      ...last.runtimeErrors.map((e) => e.message),
    ];
    return all.join('; ').slice(0, 500) || 'Unknown error';
  }
}
