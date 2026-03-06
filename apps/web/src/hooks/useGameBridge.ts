import { useState, useEffect, useCallback, type RefObject } from 'react';

export type GameBridgeState = 'idle' | 'intro' | 'playing' | 'paused' | 'gameover';

export type GameBridgeCommand = 'start' | 'pause' | 'resume' | 'restart' | 'mute' | 'unmute' | 'restore';

export interface GameScore {
  score: number;
  level?: number;
  timeElapsed: number;
  customData?: Record<string, unknown>;
}

export interface GameProgressData {
  [key: string]: unknown;
}

interface GameBridgeResult {
  gameState: GameBridgeState;
  score: GameScore | null;
  isReady: boolean;
  hasError: boolean;
  errorMessage: string | null;
  sendCommand: (command: GameBridgeCommand, data?: unknown) => void;
  sendRestore: (data: unknown) => void;
}

/**
 * PostMessage bridge between the React shell and the game iframe.
 *
 * Listens for game reports:
 * - `sloppy:game:ready` — game finished init
 * - `sloppy:state` — game state machine changed
 * - `sloppy:score` — score update
 * - `sloppy:progress` — save-progress payload
 * - `sloppy:game:error` — game runtime error
 *
 * Sends commands: start, pause, resume, restart, mute, unmute, restore
 */
export function useGameBridge(
  iframeRef: RefObject<HTMLIFrameElement | null>,
  options?: {
    onProgress?: (data: GameProgressData) => void;
    onError?: (message: string, stack?: string) => void;
    onReady?: () => void;
  },
  /** Pass the iframe src so bridge state resets when the game changes */
  src?: string,
): GameBridgeResult {
  const [gameState, setGameState] = useState<GameBridgeState>('idle');
  const [score, setScore] = useState<GameScore | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const sendCommand = useCallback(
    (command: GameBridgeCommand, data?: unknown) => {
      const win = iframeRef.current?.contentWindow;
      if (!win) return;

      if (command === 'mute' || command === 'unmute') {
        win.postMessage({ type: `sloppy:${command}` }, '*');
      } else if (command === 'restore') {
        win.postMessage({ type: 'sloppy:restore', data }, '*');
      } else {
        win.postMessage({ type: 'sloppy:command', command }, '*');
      }
    },
    [iframeRef],
  );

  const sendRestore = useCallback(
    (data: unknown) => {
      sendCommand('restore', data);
    },
    [sendCommand],
  );

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      const type = e.data?.type;
      if (!type || typeof type !== 'string') return;

      switch (type) {
        case 'sloppy:game:ready':
          setIsReady(true);
          setHasError(false);
          setErrorMessage(null);
          options?.onReady?.();
          break;

        case 'sloppy:state':
          if (e.data.state) {
            setGameState(e.data.state as GameBridgeState);
          }
          break;

        case 'sloppy:score':
          if (e.data.score) {
            setScore(e.data.score as GameScore);
          }
          break;

        case 'sloppy:progress':
          if (e.data.data) {
            options?.onProgress?.(e.data.data);
          }
          break;

        case 'sloppy:game:error':
        case 'error': {
          const msg = e.data?.message ?? e.data?.error ?? 'Unknown game error';
          const stack = e.data?.stack ?? '';
          setHasError(true);
          setErrorMessage(msg);
          options?.onError?.(msg, stack);
          break;
        }
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [options?.onProgress, options?.onError, options?.onReady]);

  // Reset state when game src changes
  useEffect(() => {
    setGameState('idle');
    setScore(null);
    setIsReady(false);
    setHasError(false);
    setErrorMessage(null);
  }, [src]);

  return { gameState, score, isReady, hasError, errorMessage, sendCommand, sendRestore };
}
