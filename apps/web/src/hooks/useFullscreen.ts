import { useState, useCallback, useEffect, type RefObject } from 'react';

interface FullscreenState {
  isFullscreen: boolean;
  enterFullscreen: () => Promise<void>;
  exitFullscreen: () => Promise<void>;
  toggleFullscreen: () => Promise<void>;
  /** True when using CSS viewport overlay instead of native Fullscreen API */
  isFallback: boolean;
}

const CSS_FALLBACK_CLASS = 'sloppy-fullscreen-fallback';

function supportsFullscreenApi(): boolean {
  return !!(
    document.documentElement.requestFullscreen ||
    (document.documentElement as any).webkitRequestFullscreen
  );
}

/**
 * Manages fullscreen mode for a given element.
 *
 * Uses the native Fullscreen API where available (desktop Chrome, Firefox, etc.)
 * and falls back to a CSS viewport overlay on iOS Safari and other browsers
 * where the Fullscreen API is restricted.
 */
export function useFullscreen(elementRef: RefObject<HTMLElement | null>): FullscreenState {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isFallback, setIsFallback] = useState(false);

  const enterFullscreen = useCallback(async () => {
    const el = elementRef.current;
    if (!el) return;

    if (supportsFullscreenApi()) {
      try {
        if (el.requestFullscreen) {
          await el.requestFullscreen();
        } else if ((el as any).webkitRequestFullscreen) {
          await (el as any).webkitRequestFullscreen();
        }
        return;
      } catch {
        // Fullscreen API rejected (e.g. not triggered by user gesture) — fall through to CSS
      }
    }

    el.classList.add(CSS_FALLBACK_CLASS);
    setIsFullscreen(true);
    setIsFallback(true);
  }, [elementRef]);

  const exitFullscreen = useCallback(async () => {
    const el = elementRef.current;

    if (document.fullscreenElement || (document as any).webkitFullscreenElement) {
      try {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        }
        return;
      } catch {
        // ignore
      }
    }

    if (el) {
      el.classList.remove(CSS_FALLBACK_CLASS);
    }
    setIsFullscreen(false);
    setIsFallback(false);
  }, [elementRef]);

  const toggleFullscreen = useCallback(async () => {
    if (isFullscreen) {
      await exitFullscreen();
    } else {
      await enterFullscreen();
    }
  }, [isFullscreen, enterFullscreen, exitFullscreen]);

  // Sync state with native fullscreen change events
  useEffect(() => {
    const handler = () => {
      const active = !!(document.fullscreenElement || (document as any).webkitFullscreenElement);
      setIsFullscreen(active);
      if (!active) setIsFallback(false);
    };

    document.addEventListener('fullscreenchange', handler);
    document.addEventListener('webkitfullscreenchange', handler);
    return () => {
      document.removeEventListener('fullscreenchange', handler);
      document.removeEventListener('webkitfullscreenchange', handler);
    };
  }, []);

  // Cleanup CSS fallback on unmount
  useEffect(() => {
    return () => {
      elementRef.current?.classList.remove(CSS_FALLBACK_CLASS);
    };
  }, [elementRef]);

  return { isFullscreen, enterFullscreen, exitFullscreen, toggleFullscreen, isFallback };
}
