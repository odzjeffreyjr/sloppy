import { useRef, useEffect, useState, useCallback, useMemo, type ReactNode, type RefObject } from 'react';
import { motion } from 'framer-motion';
import { useFullscreen } from '../hooks/useFullscreen';
import { useGameBridge, type GameBridgeCommand, type GameProgressData } from '../hooks/useGameBridge';
import { SloppySpinner } from './ui/SloppySpinner';

export type GamePlayerMode = 'inline' | 'overlay' | 'fullscreen';

interface GamePlayerShellProps {
  src: string;
  title: string;
  /** Game resolution width (default 960) */
  gameWidth?: number;
  /** Game resolution height (default 540) */
  gameHeight?: number;
  /** Scale mode from config.json (default 'fit') */
  scaleMode?: 'fit' | 'fill' | 'stretch';
  /** Current player mode */
  mode: GamePlayerMode;
  /** Show fullscreen toggle button */
  showFullscreenToggle?: boolean;
  /** Called when game reports progress data */
  onProgress?: (data: GameProgressData) => void;
  /** Called on game runtime error */
  onError?: (message: string, stack?: string) => void;
  /** Called when game iframe fires ready signal */
  onReady?: () => void;
  /** Called when iframe loads (HTML loaded, may not be game-ready yet) */
  onIframeLoad?: () => void;
  /** Called when iframe fails to load */
  onIframeError?: () => void;
  /** Exposes the internal iframe ref to parent (e.g. for multiplayer postMessage) */
  iframeRef?: RefObject<HTMLIFrameElement | null>;
  /** Additional content rendered over the game (e.g. HUD overlays) */
  children?: ReactNode;
}

const DEFAULT_WIDTH = 960;
const DEFAULT_HEIGHT = 540;

export function GamePlayerShell({
  src,
  title,
  gameWidth = DEFAULT_WIDTH,
  gameHeight = DEFAULT_HEIGHT,
  scaleMode = 'fit',
  mode,
  showFullscreenToggle = true,
  onProgress,
  onError,
  onReady,
  onIframeLoad,
  onIframeError,
  iframeRef: externalIframeRef,
  children,
}: GamePlayerShellProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const internalIframeRef = useRef<HTMLIFrameElement>(null);
  const iframeRef = externalIframeRef ?? internalIframeRef;
  const [isIframeLoaded, setIsIframeLoaded] = useState(false);
  const [iframeLoadError, setIframeLoadError] = useState(false);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });

  const { isFullscreen, toggleFullscreen } = useFullscreen(containerRef);

  const bridgeCallbacks = useMemo(() => ({
    onProgress,
    onError,
    onReady,
  }), [onProgress, onError, onReady]);

  const { hasError, errorMessage } =
    useGameBridge(iframeRef, bridgeCallbacks, src);

  // Measure container for scaling
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setViewportSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Calculate CSS scale based on viewport and game resolution
  const scale = useMemo(() => {
    if (viewportSize.width === 0 || viewportSize.height === 0) return 1;

    if (scaleMode === 'stretch') {
      return 1; // iframe fills container via CSS, no transform needed
    }

    const scaleX = viewportSize.width / gameWidth;
    const scaleY = viewportSize.height / gameHeight;

    if (scaleMode === 'fill') {
      return Math.max(scaleX, scaleY);
    }

    // 'fit' — letterbox/pillarbox
    return Math.min(scaleX, scaleY);
  }, [viewportSize, gameWidth, gameHeight, scaleMode]);

  const handleIframeLoad = useCallback(() => {
    setIsIframeLoaded(true);
    onIframeLoad?.();
  }, [onIframeLoad]);

  const handleIframeError = useCallback(() => {
    setIsIframeLoaded(true);
    setIframeLoadError(true);
    onIframeError?.();
  }, [onIframeError]);

  // Reset state when src changes
  useEffect(() => {
    setIsIframeLoaded(false);
    setIframeLoadError(false);
  }, [src]);

  const iframeStyle = useMemo(() => {
    if (scaleMode === 'stretch') {
      return { width: '100%', height: '100%' };
    }

    return {
      width: `${gameWidth}px`,
      height: `${gameHeight}px`,
      transform: `scale(${scale})`,
      transformOrigin: 'center center',
    };
  }, [scaleMode, gameWidth, gameHeight, scale]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-black overflow-hidden"
      style={{ contain: 'layout' }}
    >
      {/* Loading state */}
      {!isIframeLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-black z-20">
          <div className="flex flex-col items-center gap-4">
            <SloppySpinner size={64} />
            <span className="font-heading text-white/60 text-lg">Loading game...</span>
          </div>
        </div>
      )}

      {/* Error state */}
      {iframeLoadError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black z-20">
          <div className="flex flex-col items-center gap-4 text-center px-4">
            <span className="text-5xl">💥</span>
            <span className="font-heading text-white/60 text-lg">Failed to load game</span>
          </div>
        </div>
      )}

      {/* Runtime error overlay */}
      {hasError && !iframeLoadError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-20">
          <div className="flex flex-col items-center gap-4 text-center px-4">
            <span className="text-5xl">⚠️</span>
            <span className="font-heading text-white/60 text-lg">Game error</span>
            {errorMessage && (
              <span className="text-white/40 text-sm max-w-sm truncate">{errorMessage}</span>
            )}
          </div>
        </div>
      )}

      {/* Scaled iframe container */}
      <div className="absolute inset-0 flex items-center justify-center">
        <iframe
          ref={iframeRef}
          src={src}
          sandbox="allow-scripts"
          title={title}
          className="border-none"
          style={iframeStyle}
          onLoad={handleIframeLoad}
          onError={handleIframeError}
        />
      </div>

      {/* Fullscreen toggle button */}
      {showFullscreenToggle && isIframeLoaded && !iframeLoadError && (
        <motion.button
          className="absolute top-3 right-3 z-30 w-9 h-9 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center border-0 cursor-pointer text-white/80 hover:text-white hover:bg-black/60 transition-colors"
          whileTap={{ scale: 0.85 }}
          onClick={toggleFullscreen}
          aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
        >
          {isFullscreen ? (
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M8 3v3a2 2 0 01-2 2H3M21 8h-3a2 2 0 01-2-2V3M3 16h3a2 2 0 012 2v3M16 21v-3a2 2 0 012-2h3" />
            </svg>
          ) : (
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M8 3H5a2 2 0 00-2 2v3M21 8V5a2 2 0 00-2-2h-3M3 16v3a2 2 0 002 2h3M16 21h3a2 2 0 002-2v-3" />
            </svg>
          )}
        </motion.button>
      )}

      {/* Child overlays (touch controls, HUD, multiplayer, etc.) */}
      {children}
    </div>
  );
}

export { type GameBridgeCommand, type GameProgressData };
