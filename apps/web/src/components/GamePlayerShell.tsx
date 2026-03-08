import { useRef, useEffect, useState, useCallback, useMemo, type ReactNode, type RefObject } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import { useFullscreen } from '../hooks/useFullscreen';
import { useGameBridge, type GameBridgeCommand, type GameProgressData } from '../hooks/useGameBridge';
import { SloppySpinner } from './ui/SloppySpinner';
import { MobileTouchControls } from './MobileTouchControls';

export type GamePlayerMode = 'inline' | 'overlay' | 'fullscreen';

interface GamePlayerShellProps {
  src: string;
  title: string;
  gameWidth?: number;
  gameHeight?: number;
  scaleMode?: 'fit' | 'fill' | 'stretch';
  mode: GamePlayerMode;
  genre?: string;
  showFullscreenToggle?: boolean;
  onProgress?: (data: GameProgressData) => void;
  onError?: (message: string, stack?: string) => void;
  onReady?: () => void;
  onIframeLoad?: () => void;
  onIframeError?: () => void;
  iframeRef?: RefObject<HTMLIFrameElement | null>;
  children?: ReactNode;
}

const DEFAULT_WIDTH = 960;
const DEFAULT_HEIGHT = 540;

function useMobileOrientation() {
  const [isMobilePortrait, setIsMobilePortrait] = useState(false);
  const [isMobileLandscape, setIsMobileLandscape] = useState(false);

  useEffect(() => {
    const check = () => {
      const isMobile = 'ontouchstart' in window || window.innerWidth < 1024;
      const isPortrait = window.innerHeight > window.innerWidth;
      setIsMobilePortrait(isMobile && isPortrait);
      setIsMobileLandscape(isMobile && !isPortrait);
    };
    check();
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);
    return () => {
      window.removeEventListener('resize', check);
      window.removeEventListener('orientationchange', check);
    };
  }, []);

  return { isMobilePortrait, isMobileLandscape };
}

export function GamePlayerShell({
  src,
  title,
  gameWidth = DEFAULT_WIDTH,
  gameHeight = DEFAULT_HEIGHT,
  scaleMode = 'fit',
  mode,
  genre,
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
  const { isMobileLandscape } = useMobileOrientation();

  const bridgeCallbacks = useMemo(() => ({
    onProgress,
    onError,
    onReady,
  }), [onProgress, onError, onReady]);

  const { hasError, errorMessage } =
    useGameBridge(iframeRef, bridgeCallbacks, src);

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

  const scale = useMemo(() => {
    if (viewportSize.width === 0 || viewportSize.height === 0) return 1;
    if (scaleMode === 'stretch' || isMobileLandscape) return 1;

    const scaleX = viewportSize.width / gameWidth;
    const scaleY = viewportSize.height / gameHeight;

    if (scaleMode === 'fill') return Math.max(scaleX, scaleY);
    return Math.min(scaleX, scaleY);
  }, [viewportSize, gameWidth, gameHeight, scaleMode, isMobileLandscape]);

  const handleIframeLoad = useCallback(() => {
    setIsIframeLoaded(true);
    onIframeLoad?.();
  }, [onIframeLoad]);

  const handleIframeError = useCallback(() => {
    setIsIframeLoaded(true);
    setIframeLoadError(true);
    onIframeError?.();
  }, [onIframeError]);

  useEffect(() => {
    setIsIframeLoaded(false);
    setIframeLoadError(false);
  }, [src]);

  const iframeStyle = useMemo(() => {
    if (scaleMode === 'stretch' || isMobileLandscape) {
      return { width: '100%', height: '100%' };
    }

    return {
      width: `${gameWidth}px`,
      height: `${gameHeight}px`,
      transform: `scale(${scale})`,
      transformOrigin: 'center center',
    };
  }, [scaleMode, gameWidth, gameHeight, scale, isMobileLandscape]);

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
            <AlertTriangle size={48} className="text-white/60" />
            <span className="font-heading text-white/60 text-lg">Failed to load game</span>
          </div>
        </div>
      )}

      {/* Runtime error overlay */}
      {hasError && !iframeLoadError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-20">
          <div className="flex flex-col items-center gap-4 text-center px-4">
            <AlertTriangle size={32} className="text-white/60" />
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
      {showFullscreenToggle && isIframeLoaded && !iframeLoadError && !isMobileLandscape && (
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

      {/* Mobile touch controls overlay */}
      <MobileTouchControls
        genre={genre}
        iframeRef={iframeRef}
        visible={isIframeLoaded && !iframeLoadError && !hasError}
      />

      {/* Portrait blocker — requires landscape to play, pauses/resumes game */}
      {mode !== 'inline' && <PortraitBlocker iframeRef={iframeRef} />}

      {/* Child overlays (HUD, multiplayer, etc.) */}
      {children}
    </div>
  );
}

export function PortraitBlocker({ iframeRef }: { iframeRef?: RefObject<HTMLIFrameElement | null> }) {
  const { isMobilePortrait } = useMobileOrientation();
  const wasPaused = useRef(false);

  useEffect(() => {
    const win = iframeRef?.current?.contentWindow;
    if (!win) return;

    if (isMobilePortrait) {
      win.postMessage({ type: 'sloppy:command', command: 'pause' }, '*');
      wasPaused.current = true;
    } else if (wasPaused.current) {
      win.postMessage({ type: 'sloppy:command', command: 'start' }, '*');
      wasPaused.current = false;
    }
  }, [isMobilePortrait, iframeRef]);

  if (!isMobilePortrait) return null;

  return (
    <div className="absolute inset-0 z-50 bg-black flex flex-col items-center justify-center gap-6 px-8">
      <motion.div
        animate={{ rotate: [0, -90, -90, 0] }}
        transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 1, ease: 'easeInOut' }}
      >
        <svg className="w-16 h-16 text-white/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
          <rect x="5" y="2" width="14" height="20" rx="2" />
          <path d="M12 18h.01" />
        </svg>
      </motion.div>
      <p className="font-heading text-white text-lg text-center">
        Rotate your device to play
      </p>
      <p className="text-white/40 text-sm text-center max-w-[250px]">
        Games are best experienced in landscape mode
      </p>
    </div>
  );
}

export { type GameBridgeCommand, type GameProgressData };
