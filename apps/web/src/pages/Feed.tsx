import { useEffect, useRef, useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Gamepad2 } from 'lucide-react';
import { useGameStore } from '../stores/game';
import { useUIStore } from '../stores/ui';
import { useAuthStore } from '../stores/auth';
import { useFeedWindow, buildGameSrc } from '../hooks/useFeedWindow';
import { tikTokFeedApi, type GameFeedItem } from '../lib/api';
import { SloppyButton } from '../components/ui/SloppyButton';
import { SloppySpinner } from '../components/ui/SloppySpinner';
import { AdSlot } from '../components/ui/AdSlot';
import { toast } from '../components/ui/SloppyToast';

const PROGRESS_SAVE_INTERVAL_MS = 10_000;

export default function Feed() {
  const navigate = useNavigate();
  const { openGameOverlay } = useUIStore();
  const setGameAudioActive = useUIStore((s) => s.setGameAudioActive);
  const {
    tikTokGames,
    isLoadingTikTok,
    tikTokError,
    hasMoreTikTok,
    fetchTikTokFeed,
    favouriteGame,
    unfavouriteGame,
  } = useGameStore();

  // Pause global music while the feed is active; resume on unmount
  // unless the game overlay is taking over (e.g. user opened a game).
  useEffect(() => {
    setGameAudioActive(true);
    return () => {
      if (!useUIStore.getState().isGameOverlayOpen) {
        setGameAudioActive(false);
      }
    };
  }, [setGameAudioActive]);

  const [isMuted, setIsMuted] = useState(true);
  const [showControls, setShowControls] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const controlsTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [showFeedAd, setShowFeedAd] = useState(false);
  const transitionCount = useRef(0);
  const feedAdTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Initial load
  useEffect(() => {
    if (tikTokGames.length === 0) {
      fetchTikTokFeed(true);
    }
  }, [fetchTikTokFeed, tikTokGames.length]);

  const handleNearEnd = useCallback(() => {
    if (hasMoreTikTok) fetchTikTokFeed(false);
  }, [hasMoreTikTok, fetchTikTokFeed]);

  const {
    currentIndex,
    currentGame,
    prevGame,
    nextGame,
    canGoPrev,
    canGoNext,
    goNext,
    goPrev,
    direction,
  } = useFeedWindow(tikTokGames, {
    onNearEnd: handleNearEnd,
    nearEndThreshold: 2,
  });

  const AD_EVERY_N = 3;

  const dismissFeedAd = useCallback(() => {
    clearTimeout(feedAdTimer.current);
    setShowFeedAd(false);
    goNext();
  }, [goNext]);

  const handleGoNext = useCallback(() => {
    if (showFeedAd) return;
    setIsPlaying(false);
    transitionCount.current += 1;
    if (transitionCount.current % AD_EVERY_N === 0) {
      setShowFeedAd(true);
      feedAdTimer.current = setTimeout(dismissFeedAd, 3000);
    } else {
      goNext();
    }
  }, [goNext, showFeedAd, dismissFeedAd]);

  const handleGoPrev = useCallback(() => {
    setIsPlaying(false);
    goPrev();
  }, [goPrev]);

  // Track view event when game changes
  useEffect(() => {
    if (currentGame) {
      tikTokFeedApi.trackEvent(currentGame.id, 'view');
    }
  }, [currentGame?.id]);

  // Touch / scroll / keyboard navigation
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef(0);
  const touchStartTime = useRef(0);
  const lastWheelNav = useRef(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const WHEEL_COOLDOWN_MS = 400;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (Math.abs(e.deltaY) < 30) return;
      const now = Date.now();
      if (now - lastWheelNav.current < WHEEL_COOLDOWN_MS) return;
      lastWheelNav.current = now;
      if (e.deltaY > 0) handleGoNext();
      else handleGoPrev();
    };

    const handleTouchStart = (e: TouchEvent) => {
      touchStartY.current = e.touches[0].clientY;
      touchStartTime.current = Date.now();
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const deltaY = touchStartY.current - e.changedTouches[0].clientY;
      const elapsed = Date.now() - touchStartTime.current;
      const velocity = Math.abs(deltaY) / elapsed;

      if (Math.abs(deltaY) < 50 && velocity < 0.5) return;

      if (deltaY > 0) handleGoNext();
      else handleGoPrev();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isPlaying) setIsPlaying(false);
        else navigate('/');
        return;
      }
      if (isPlaying) return;
      if (e.key === 'ArrowDown' || e.key === 'j') handleGoNext();
      else if (e.key === 'ArrowUp' || e.key === 'k') handleGoPrev();
      else if (e.key === 'm') setIsMuted((m) => !m);
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      el.removeEventListener('wheel', handleWheel);
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleGoNext, handleGoPrev, navigate, isPlaying]);

  // Show/hide controls on hover/tap
  const handleInteraction = useCallback(() => {
    setShowControls(true);
    clearTimeout(controlsTimeout.current);
    controlsTimeout.current = setTimeout(() => setShowControls(false), 3000);
  }, []);

  useEffect(() => {
    return () => {
      clearTimeout(controlsTimeout.current);
      clearTimeout(feedAdTimer.current);
    };
  }, []);

  // Loading state
  if (isLoadingTikTok && tikTokGames.length === 0) {
    return (
      <div className="fixed inset-0 z-40 bg-sloppy-bg flex items-center justify-center" style={{ height: '100dvh' }}>
        <div className="flex flex-col items-center gap-4">
          <SloppySpinner size={64} />
          <span className="font-heading text-sloppy-text-muted text-lg">Loading feed...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (tikTokError && tikTokGames.length === 0) {
    return (
      <div className="fixed inset-0 z-40 bg-sloppy-bg flex items-center justify-center" style={{ height: '100dvh' }}>
        <div className="flex flex-col items-center gap-4">
          <AlertTriangle size={48} className="text-sloppy-text-muted" />
          <span className="font-heading text-sloppy-text-muted text-lg">Failed to load feed</span>
          <SloppyButton onClick={() => fetchTikTokFeed(true)}>Retry</SloppyButton>
        </div>
      </div>
    );
  }

  // Empty state
  if (!isLoadingTikTok && tikTokGames.length === 0) {
    return (
      <div className="fixed inset-0 z-40 bg-sloppy-bg flex items-center justify-center" style={{ height: '100dvh' }}>
        <div className="flex flex-col items-center gap-4">
          <Gamepad2 size={56} className="text-sloppy-text-muted" />
          <h2 className="font-heading text-2xl text-sloppy-text">No games in the feed yet!</h2>
          <SloppyButton onClick={() => navigate('/create')}>Create a Game</SloppyButton>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-40 bg-black overflow-hidden select-none"
      style={{ height: '100dvh' }}
      onMouseMove={handleInteraction}
      onTouchStart={handleInteraction}
    >
      {/* Header */}
      <FeedHeader
        show={showControls}
        isMuted={isMuted}
        isPlaying={isPlaying}
        onToggleMute={() => setIsMuted((m) => !m)}
        onClose={() => navigate('/')}
        onSearch={() => navigate('/explore')}
      />

      {/* Sliding window of iframes */}
      <div className="absolute inset-0" style={{ height: '100dvh' }}>
        <AnimatePresence initial={false} custom={direction}>
          {currentGame && (
            <motion.div
              key={currentGame.id}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: 'tween', duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
              className="absolute inset-0"
              style={{ height: '100dvh' }}
            >
              <FeedSlide
                game={currentGame}
                isMuted={isMuted}
                isActive
                isPlaying={isPlaying}
                onPlay={() => setIsPlaying(true)}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Preloaded iframes (hidden) */}
        {prevGame && (
          <div className="absolute inset-0 invisible" aria-hidden="true" style={{ height: '100dvh' }}>
            <FeedSlide game={prevGame} isMuted isActive={false} />
          </div>
        )}
        {nextGame && (
          <div className="absolute inset-0 invisible" aria-hidden="true" style={{ height: '100dvh' }}>
            <FeedSlide game={nextGame} isMuted isActive={false} />
          </div>
        )}

      </div>

      {/* Game info overlay */}
      {currentGame && (
        <FeedGameInfo
          game={currentGame}
          show={showControls}
          isPlaying={isPlaying}
          onFavourite={() => {
            const { isAuthenticated, login } = useAuthStore.getState();
            if (!isAuthenticated) {
              toast('Sign in to favourite games', 'info');
              login('google').catch(() => {});
              return;
            }
            if (currentGame.isFavourited) {
              unfavouriteGame(currentGame.id);
            } else {
              favouriteGame(currentGame.id);
              tikTokFeedApi.trackEvent(currentGame.id, 'favourite');
            }
          }}
          onPlay={() => {
            openGameOverlay(currentGame.id, currentGame, true);
            navigate(`/game/${currentGame.id}`);
          }}
          onShare={async () => {
            const url = `${window.location.origin}/game/${currentGame.id}`;
            if (navigator.share) {
              try {
                await navigator.share({
                  title: currentGame.title,
                  text: `Check out "${currentGame.title}" on Sloppy!`,
                  url,
                });
                return;
              } catch {
                // User cancelled or share failed — fall through to clipboard
              }
            }
            try {
              await navigator.clipboard.writeText(url);
              toast('Link copied to clipboard', 'success');
            } catch {
              toast('Failed to copy link', 'error');
            }
          }}
        />
      )}

      {/* Pre-game ad overlay (every 3rd transition) */}
      <AnimatePresence>
        {showFeedAd && (
          <motion.div
            className="absolute inset-0 z-[60] bg-black/80 flex flex-col items-center justify-center gap-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <AdSlot format="interstitial" />
            <motion.button
              className="cursor-pointer px-4 py-1.5 text-white/60 text-xs border border-white/20 rounded-full bg-transparent hover:bg-white/10 transition-colors"
              whileTap={{ scale: 0.95 }}
              onClick={dismissFeedAd}
            >
              Skip
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Play mode indicator with exit button */}
      <AnimatePresence>
        {isPlaying && (
          <motion.div
            className="absolute top-14 left-1/2 -translate-x-1/2 z-[70] pointer-events-none"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <button
              className="cursor-pointer pointer-events-auto flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-sm border-0 hover:bg-black/80 transition-colors"
              onClick={() => setIsPlaying(false)}
              aria-label="Exit play mode"
            >
              <span className="text-white/80 text-xs font-medium">Playing</span>
              <svg className="w-3.5 h-3.5 text-white/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tap to play hint (shown briefly on new game) */}
      {!isPlaying && showControls && currentGame && (
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 pointer-events-none"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 0.7, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <div className="flex flex-col items-center gap-2 px-5 py-3 rounded-2xl bg-black/50 backdrop-blur-sm">
            <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
            </svg>
            <span className="text-white text-xs font-medium">Tap to play</span>
          </div>
        </motion.div>
      )}

      {/* Navigation indicators */}
      <FeedNavHints
        canGoPrev={canGoPrev}
        canGoNext={canGoNext}
        show={showControls}
        isPlaying={isPlaying}
        currentIndex={currentIndex}
        total={tikTokGames.length}
        onPrev={handleGoPrev}
        onNext={handleGoNext}
      />

      {/* Loading more indicator */}
      {isLoadingTikTok && tikTokGames.length > 0 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
          <SloppySpinner size={24} />
        </div>
      )}
    </div>
  );
}

// ── Slide variants for framer-motion ────────────────────────────────

const slideVariants = {
  enter: (direction: number) => ({
    y: direction >= 0 ? '100%' : '-100%',
    opacity: 0.8,
  }),
  center: {
    y: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    y: direction >= 0 ? '-100%' : '100%',
    opacity: 0.8,
  }),
};

// ── FeedSlide ───────────────────────────────────────────────────────

function FeedSlide({
  game,
  isMuted,
  isActive,
  isPlaying = false,
  onPlay,
}: {
  game: GameFeedItem;
  isMuted: boolean;
  isActive: boolean;
  isPlaying?: boolean;
  onPlay?: () => void;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const progressTimer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const startTime = useRef(Date.now());

  const src = game.storagePath ? buildGameSrc(game) : null;

  // Listen for sloppy:game:ready from THIS iframe to know when the game
  // engine has finished async init (Phaser, Three.js, etc.). The iframe
  // onLoad event fires earlier (HTML parsed) before scripts finish init.
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.source !== iframeRef.current?.contentWindow) return;
      if (
        e.data === 'sloppy:game:ready' ||
        (e.data && e.data.type === 'sloppy:game:ready')
      ) {
        setReady(true);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [game.title]);

  // Detect if the iframe loaded the wrong content (e.g. the main SPA
  // served by Firebase's catch-all rewrite instead of the actual game).
  // The main app's HTML triggers registerSW.js errors and never sends
  // sloppy:game:ready — treat it as a load failure after a timeout.
  useEffect(() => {
    if (!src || ready || loadError) return;
    const timeout = setTimeout(() => {
      if (!ready) setLoadError(true);
    }, 8000);
    return () => clearTimeout(timeout);
  }, [src, ready, loadError]);

  // Send mute/unmute commands to the game
  useEffect(() => {
    if (!ready || !iframeRef.current?.contentWindow) return;
    iframeRef.current.contentWindow.postMessage(
      { type: isMuted ? 'sloppy:mute' : 'sloppy:unmute' },
      '*',
    );
  }, [isMuted, ready]);

  // Auto-start when active and game is ready, pause when inactive
  useEffect(() => {
    if (!ready || !iframeRef.current?.contentWindow) return;
    if (isActive) {
      startTime.current = Date.now();
      iframeRef.current.contentWindow.postMessage({ type: 'sloppy:command', command: 'start' }, '*');
      tikTokFeedApi.trackEvent(game.id, 'play_start');
    } else {
      iframeRef.current.contentWindow.postMessage({ type: 'sloppy:command', command: 'pause' }, '*');
      const elapsed = Date.now() - startTime.current;
      if (elapsed > 2000) {
        tikTokFeedApi.trackEvent(game.id, 'play_time', elapsed);
      }
    }
  }, [isActive, ready, game.id]);

  // Debounced progress saving
  useEffect(() => {
    if (!isActive) {
      clearInterval(progressTimer.current);
      return;
    }

    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === 'sloppy:progress' && e.data?.data) {
        const localKey = `sloppy_progress_${game.id}`;
        try {
          localStorage.setItem(localKey, JSON.stringify(e.data.data));
        } catch { /* quota exceeded */ }
      }
    };

    window.addEventListener('message', handleMessage);

    progressTimer.current = setInterval(() => {
      const localKey = `sloppy_progress_${game.id}`;
      const saved = localStorage.getItem(localKey);
      if (saved) {
        tikTokFeedApi.saveProgress(game.id, {
          progressData: JSON.parse(saved),
          playTimeMs: Date.now() - startTime.current,
        }).catch(() => {});
      }
    }, PROGRESS_SAVE_INTERVAL_MS);

    return () => {
      window.removeEventListener('message', handleMessage);
      clearInterval(progressTimer.current);
    };
  }, [isActive, game.id]);

  // Restore saved progress once game is ready
  useEffect(() => {
    if (!ready || !isActive || !iframeRef.current?.contentWindow) return;

    const localKey = `sloppy_progress_${game.id}`;
    const saved = localStorage.getItem(localKey);
    if (saved) {
      try {
        iframeRef.current.contentWindow.postMessage(
          { type: 'sloppy:restore', data: JSON.parse(saved) },
          '*',
        );
      } catch { /* parse error */ }
    }
  }, [ready, isActive, game.id]);

  // When entering play mode: focus iframe for keyboard input + skip intro
  useEffect(() => {
    if (!isPlaying || !iframeRef.current) return;

    const sendRestart = () => {
      iframeRef.current!.contentWindow?.focus();
      requestAnimationFrame(() => {
        iframeRef.current?.contentWindow?.postMessage(
          { type: 'sloppy:command', command: 'restart' },
          '*',
        );
      });
    };

    if (ready) {
      sendRestart();
    } else {
      // Game hasn't signalled ready yet — wait for it then send restart
      const handler = (e: MessageEvent) => {
        if (e.source !== iframeRef.current?.contentWindow) return;
        if (
          e.data === 'sloppy:game:ready' ||
          (e.data && e.data.type === 'sloppy:game:ready')
        ) {
          sendRestart();
          window.removeEventListener('message', handler);
        }
      };
      window.addEventListener('message', handler);
      return () => window.removeEventListener('message', handler);
    }
  }, [isPlaying, ready]);

  const handleSlideClick = useCallback(() => {
    if (!isPlaying && onPlay) {
      onPlay();
      // Defer focus + restart until after React commits the DOM update
      // (overlay removed, iframe pointer-events set to auto, z-index raised).
      // setTimeout(0) fires after React's batched state flush while the
      // user-gesture context is still active (~1 s window in Chrome),
      // which is required for cross-origin iframe focus.
      setTimeout(() => {
        if (iframeRef.current) {
          iframeRef.current.focus();
          iframeRef.current.contentWindow?.focus();
        }
        if (ready && iframeRef.current?.contentWindow) {
          iframeRef.current.contentWindow.postMessage(
            { type: 'sloppy:command', command: 'restart' },
            '*',
          );
        }
      }, 0);
    }
  }, [isPlaying, onPlay, ready]);

  if (!src || loadError) {
    return (
      <div className="w-full h-full relative bg-black flex flex-col items-center justify-center gap-3">
        {game.thumbnailUrl ? (
          <img
            src={game.thumbnailUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover opacity-20 blur-md"
          />
        ) : null}
        <Gamepad2 size={48} className="text-white/60 relative z-10" />
        <span className="font-heading text-white/60 text-sm relative z-10">
          {loadError ? 'Failed to load game' : 'Game not available'}
        </span>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative bg-black">
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
          {game.thumbnailUrl ? (
            <img
              src={game.thumbnailUrl}
              alt=""
              className="absolute inset-0 w-full h-full object-cover opacity-30 blur-md"
            />
          ) : null}
          <SloppySpinner size={48} />
        </div>
      )}
      <iframe
        ref={iframeRef}
        src={src}
        sandbox="allow-scripts allow-same-origin"
        title={game.title}
        tabIndex={isPlaying ? 0 : -1}
        className="w-full h-full border-none"
        onLoad={() => setLoaded(true)}
        onError={() => setLoadError(true)}
        onFocus={() => iframeRef.current?.contentWindow?.focus()}
        style={{
          visibility: loaded ? 'visible' : 'hidden',
          outline: 'none',
          pointerEvents: isPlaying ? 'auto' : 'none',
          position: isPlaying ? 'relative' : undefined,
          zIndex: isPlaying ? 60 : undefined,
        }}
      />
      {/* Click overlay — sits on top of the iframe to capture taps.
          Iframes swallow click events even with pointer-events:none in
          some browsers, so we need an explicit overlay to catch "tap to play". */}
      {!isPlaying && (
        <div
          className="absolute inset-0 z-20 cursor-pointer"
          onClick={handleSlideClick}
          role="button"
          tabIndex={-1}
          aria-label="Tap to play game"
        />
      )}
    </div>
  );
}

// ── FeedHeader ──────────────────────────────────────────────────────

function FeedHeader({
  show,
  isMuted,
  isPlaying,
  onToggleMute,
  onClose,
  onSearch,
}: {
  show: boolean;
  isMuted: boolean;
  isPlaying: boolean;
  onToggleMute: () => void;
  onClose: () => void;
  onSearch: () => void;
}) {
  return (
    <motion.div
      className={`absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3 ${isPlaying ? 'pointer-events-none' : ''}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: show ? 1 : 0.4 }}
      transition={{ duration: 0.2 }}
      style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.6), transparent)' }}
    >
      <div className="flex items-center gap-3">
        <motion.button
          className={`cursor-pointer text-white/90 p-2 rounded-full hover:bg-white/10 border-0 bg-transparent ${isPlaying ? '' : 'pointer-events-auto'}`}
          whileTap={{ scale: 0.9 }}
          onClick={onClose}
          aria-label="Close feed"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </motion.button>
        <span className="font-heading text-white text-lg tracking-wide select-none">SLOPPY FEED</span>
      </div>

      <div className="flex items-center gap-2">
        <motion.button
          className={`cursor-pointer text-white/90 p-2 rounded-full hover:bg-white/10 border-0 bg-transparent ${isPlaying ? '' : 'pointer-events-auto'}`}
          whileTap={{ scale: 0.9 }}
          onClick={onSearch}
          aria-label="Search"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
        </motion.button>
        <motion.button
          className={`cursor-pointer text-white/90 p-2 rounded-full hover:bg-white/10 border-0 bg-transparent ${isPlaying ? '' : 'pointer-events-auto'}`}
          whileTap={{ scale: 0.9 }}
          onClick={onToggleMute}
          aria-label={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? (
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M11 5L6 9H2v6h4l5 4V5z" />
              <line x1="23" y1="9" x2="17" y2="15" />
              <line x1="17" y1="9" x2="23" y2="15" />
            </svg>
          ) : (
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M11 5L6 9H2v6h4l5 4V5z" />
              <path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" />
            </svg>
          )}
        </motion.button>
      </div>
    </motion.div>
  );
}

// ── FeedGameInfo (bottom-left overlay + right action buttons) ────────

function FeedGameInfo({
  game,
  show,
  isPlaying,
  onFavourite,
  onPlay,
  onShare,
}: {
  game: GameFeedItem;
  show: boolean;
  isPlaying: boolean;
  onFavourite: () => void;
  onPlay: () => void;
  onShare: () => void | Promise<void>;
}) {
  return (
    <>
      {/* Bottom-left info */}
      <motion.div
        className={`absolute bottom-6 left-4 z-50 max-w-[60%] ${isPlaying ? 'pointer-events-none' : ''}`}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: show ? 1 : 0.7, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        <h3 className="font-heading text-white text-xl leading-tight drop-shadow-lg line-clamp-2">
          {game.title}
        </h3>
        <div className="flex flex-wrap items-center gap-2 mt-2">
          {game.genre && (
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-sloppy-primary/80 text-white">
              {game.genre.replace(/^(2d|3d)-/, '')}
            </span>
          )}
          {game.engine && (
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-sloppy-secondary/80 text-white">
              {game.engine}
            </span>
          )}
          <span className="text-white/60 text-xs">
            {game.playCount.toLocaleString()} plays
          </span>
        </div>
        {game.creatorDisplayName && (
          <p className="text-white/50 text-xs mt-1 truncate">
            by {game.creatorDisplayName}
          </p>
        )}
      </motion.div>

      {/* Right-side action buttons (TikTok-style) */}
      <motion.div
        className={`absolute right-3 bottom-24 z-50 flex flex-col items-center gap-5 ${isPlaying ? 'pointer-events-none' : ''}`}
        initial={{ opacity: 0, x: 10 }}
        animate={{ opacity: show ? 1 : 0.6, x: 0 }}
        transition={{ duration: 0.2 }}
      >
        {/* Favourite */}
        <ActionButton
          onClick={onFavourite}
          label={game.isFavourited ? 'Unfavourite' : 'Favourite'}
          count={game.favouriteCount}
        >
          <svg className="w-7 h-7" viewBox="0 0 24 24" fill={game.isFavourited ? '#ef4444' : 'none'} stroke={game.isFavourited ? '#ef4444' : 'white'} strokeWidth={2}>
            <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
          </svg>
        </ActionButton>

        {/* Play (open in game page) */}
        <ActionButton onClick={onPlay} label="Full screen">
          <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2}>
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <path d="M10 8l5 3.5-5 3.5V8z" fill="white" />
          </svg>
        </ActionButton>

        {/* Share */}
        <ActionButton onClick={onShare} label="Share">
          <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2}>
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
        </ActionButton>

        {/* Multiplayer indicator */}
        {game.supportsMultiplayer && (
          <ActionButton onClick={onPlay} label="Multiplayer">
            <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2}>
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
            </svg>
          </ActionButton>
        )}
      </motion.div>
    </>
  );
}

function ActionButton({
  onClick,
  label,
  count,
  children,
}: {
  onClick: () => void;
  label: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <motion.button
      className="cursor-pointer flex flex-col items-center gap-1 bg-transparent border-0 p-0"
      whileTap={{ scale: 0.85 }}
      onClick={onClick}
      aria-label={label}
    >
      <div className="w-12 h-12 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center">
        {children}
      </div>
      {count != null && count > 0 && (
        <span className="text-white/80 text-[10px] font-semibold">{count.toLocaleString()}</span>
      )}
    </motion.button>
  );
}

// ── Navigation hints ────────────────────────────────────────────────

function FeedNavHints({
  canGoPrev,
  canGoNext,
  show,
  isPlaying,
  currentIndex,
  total,
  onPrev,
  onNext,
}: {
  canGoPrev: boolean;
  canGoNext: boolean;
  show: boolean;
  isPlaying: boolean;
  currentIndex: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <motion.div
      className={`absolute right-3 top-1/2 -translate-y-1/2 z-50 flex-col items-center gap-3 hidden md:flex ${isPlaying ? 'pointer-events-none' : ''}`}
      animate={{ opacity: show ? 0.8 : 0.2 }}
      transition={{ duration: 0.2 }}
    >
      <motion.button
        className={`cursor-pointer w-9 h-9 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center border-0 ${
          canGoPrev ? 'text-white' : 'text-white/20'
        }`}
        whileTap={canGoPrev ? { scale: 0.85 } : undefined}
        onClick={canGoPrev ? onPrev : undefined}
        disabled={!canGoPrev}
        aria-label="Previous game"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <path d="M18 15l-6-6-6 6" />
        </svg>
      </motion.button>

      <span className="text-white/50 text-[10px] font-mono">
        {currentIndex + 1}/{total}
      </span>

      <motion.button
        className={`cursor-pointer w-9 h-9 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center border-0 ${
          canGoNext ? 'text-white' : 'text-white/20'
        }`}
        whileTap={canGoNext ? { scale: 0.85 } : undefined}
        onClick={canGoNext ? onNext : undefined}
        disabled={!canGoNext}
        aria-label="Next game"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </motion.button>
    </motion.div>
  );
}
