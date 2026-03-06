import { useState, useCallback, useRef, useEffect } from 'react';
import type { GameFeedItem } from '../lib/api';

export interface FeedWindowState {
  currentIndex: number;
  currentGame: GameFeedItem | null;
  prevGame: GameFeedItem | null;
  nextGame: GameFeedItem | null;
  canGoPrev: boolean;
  canGoNext: boolean;
  goNext: () => void;
  goPrev: () => void;
  /** Direction of the last transition: 1 = forward, -1 = backward, 0 = none */
  direction: number;
  /** True while a transition animation is in progress */
  isTransitioning: boolean;
}

const CDN_URL = import.meta.env.VITE_CDN_URL ?? '';

export function buildGameSrc(game: GameFeedItem): string {
  if (game.storagePath) {
    return `${CDN_URL}/${game.storagePath}/index.html`;
  }
  return `${CDN_URL}/games/${game.id}/v${game.version}/index.html`;
}

/**
 * 3-iframe sliding window for the TikTok-style feed.
 *
 * Maintains references to prev/current/next games so only 3 iframes
 * are alive at any time. Transitions are instant because the next
 * iframe is already loaded before the user scrolls.
 */
export function useFeedWindow(
  games: GameFeedItem[],
  opts?: {
    /** Called when the user is N games from the end of the list */
    onNearEnd?: () => void;
    nearEndThreshold?: number;
  },
): FeedWindowState {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const transitionTimeout = useRef<ReturnType<typeof setTimeout>>();

  const threshold = opts?.nearEndThreshold ?? 2;

  const currentGame = games[currentIndex] ?? null;
  const prevGame = currentIndex > 0 ? games[currentIndex - 1] : null;
  const nextGame = currentIndex < games.length - 1 ? games[currentIndex + 1] : null;

  const canGoPrev = currentIndex > 0;
  const canGoNext = currentIndex < games.length - 1;

  // Request more games when approaching the end
  useEffect(() => {
    if (games.length > 0 && currentIndex >= games.length - threshold) {
      opts?.onNearEnd?.();
    }
  }, [currentIndex, games.length, threshold, opts?.onNearEnd]);

  const goNext = useCallback(() => {
    if (isTransitioning) return;
    setCurrentIndex((i) => {
      if (i >= games.length - 1) return i;
      return i + 1;
    });
    setDirection(1);
    setIsTransitioning(true);
    clearTimeout(transitionTimeout.current);
    transitionTimeout.current = setTimeout(() => setIsTransitioning(false), 350);
  }, [games.length, isTransitioning]);

  const goPrev = useCallback(() => {
    if (isTransitioning) return;
    setCurrentIndex((i) => {
      if (i <= 0) return i;
      return i - 1;
    });
    setDirection(-1);
    setIsTransitioning(true);
    clearTimeout(transitionTimeout.current);
    transitionTimeout.current = setTimeout(() => setIsTransitioning(false), 350);
  }, [isTransitioning]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => clearTimeout(transitionTimeout.current);
  }, []);

  return {
    currentIndex,
    currentGame,
    prevGame,
    nextGame,
    canGoPrev,
    canGoNext,
    goNext,
    goPrev,
    direction,
    isTransitioning,
  };
}
