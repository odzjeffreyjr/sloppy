import { useEffect, useRef, useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../stores/game';
import { useFeedWindow, buildGameSrc } from '../hooks/useFeedWindow';
import { tikTokFeedApi, type GameFeedItem } from '../lib/api';
import { SloppySpinner } from '../components/ui/SloppySpinner';
import { AdSlot } from '../components/ui/AdSlot';

const PROGRESS_SAVE_INTERVAL_MS = 10_000;

export default function Feed() {
  const navigate = useNavigate();
  const {
    tikTokGames,
    isLoadingTikTok,
    tikTokError,
    hasMoreTikTok,
    fetchTikTokFeed,
    favouriteGame,
    unfavouriteGame,
  } = useGameStore();

  const [isMuted, setIsMuted] = useState(true);
  const [showControls, setShowControls] = useState(false);
  const controlsTimeout = useRef<ReturnType<typeof setTimeout>>();
  const [showFeedAd, setShowFeedAd] = useState(false);
  const transitionCount = useRef(0);
  const feedAdTimer = useRef<ReturnType<typeof setTimeout>>();

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
    transitionCount.current += 1;
    if (transitionCount.current % AD_EVERY_N === 0) {
      setShowFeedAd(true);
      feedAdTimer.current = setTimeout(dismissFeedAd, 3000);
    } else {
      goNext();
    }
  }, [goNext, showFeedAd, dismissFeedAd]);

  const handleGoPrev = useCallback(() => {
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

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (Math.abs(e.deltaY) < 30) return;
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
      if (e.key === 'ArrowDown' || e.key === 'j') handleGoNext();
      else if (e.key === 'ArrowUp' || e.key === 'k') handleGoPrev();
      else if (e.key === 'm') setIsMuted((m) => !m);
      else if (e.key === 'Escape') navigate('/');
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
  }, [handleGoNext, handleGoPrev, navigate]);

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
          <span className="text-5xl">💥</span>
          <span className="font-heading text-sloppy-text-muted text-lg">Failed to load feed</span>
          <motion.button
            className="cursor-pointer px-5 py-2 bg-sloppy-primary text-white font-bold rounded-wobbly border-0"
            whileTap={{ scale: 0.95 }}
            onClick={() => fetchTikTokFeed(true)}
          >
            Retry
          </motion.button>
        </div>
      </div>
    );
  }

  // Empty state
  if (!isLoadingTikTok && tikTokGames.length === 0) {
    return (
      <div className="fixed inset-0 z-40 bg-sloppy-bg flex items-center justify-center" style={{ height: '100dvh' }}>
        <div className="flex flex-col items-center gap-4">
          <span className="text-6xl">🎮</span>
          <h2 className="font-heading text-2xl text-sloppy-text">No games in the feed yet!</h2>
          <motion.button
            className="cursor-pointer px-5 py-2 bg-sloppy-primary text-white font-bold rounded-wobbly border-0"
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/create')}
          >
            Create a Game
          </motion.button>
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
          onFavourite={() => {
            if (currentGame.isFavourited) {
              unfavouriteGame(currentGame.id);
            } else {
              favouriteGame(currentGame.id);
              tikTokFeedApi.trackEvent(currentGame.id, 'favourite');
            }
          }}
          onPlay={() => navigate(`/game/${currentGame.id}`)}
          onShare={() => {
            const url = `${window.location.origin}/game/${currentGame.id}`;
            navigator.clipboard?.writeText(url);
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

      {/* Navigation indicators */}
      <FeedNavHints
        canGoPrev={canGoPrev}
        canGoNext={canGoNext}
        show={showControls}
        currentIndex={currentIndex}
        total={tikTokGames.length}
        onPrev={handleGoPrev}
        onNext={handleGoNext}
      />

      {/* Loading more indicator */}
      {isLoadingTikTok && tikTokGames.length > 0 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50">
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
}: {
  game: GameFeedItem;
  isMuted: boolean;
  isActive: boolean;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loaded, setLoaded] = useState(false);
  const progressTimer = useRef<ReturnType<typeof setInterval>>();
  const startTime = useRef(Date.now());

  const src = buildGameSrc(game);

  // Send mute/unmute commands to the game
  useEffect(() => {
    if (!loaded || !iframeRef.current?.contentWindow) return;
    iframeRef.current.contentWindow.postMessage(
      { type: isMuted ? 'sloppy:mute' : 'sloppy:unmute' },
      '*',
    );
  }, [isMuted, loaded]);

  // Auto-start when active, pause when inactive
  useEffect(() => {
    if (!loaded || !iframeRef.current?.contentWindow) return;
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
  }, [isActive, loaded, game.id]);

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

  // Restore saved progress on load
  useEffect(() => {
    if (!loaded || !isActive || !iframeRef.current?.contentWindow) return;

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
  }, [loaded, isActive, game.id]);

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
        sandbox="allow-scripts"
        title={game.title}
        className="w-full h-full border-none"
        onLoad={() => setLoaded(true)}
        style={{ visibility: loaded ? 'visible' : 'hidden' }}
      />
    </div>
  );
}

// ── FeedHeader ──────────────────────────────────────────────────────

function FeedHeader({
  show,
  isMuted,
  onToggleMute,
  onClose,
  onSearch,
}: {
  show: boolean;
  isMuted: boolean;
  onToggleMute: () => void;
  onClose: () => void;
  onSearch: () => void;
}) {
  return (
    <motion.div
      className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3"
      initial={{ opacity: 0 }}
      animate={{ opacity: show ? 1 : 0.4 }}
      transition={{ duration: 0.2 }}
      style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.6), transparent)' }}
    >
      <div className="flex items-center gap-3">
        <motion.button
          className="cursor-pointer text-white/90 p-2 rounded-full hover:bg-white/10 border-0 bg-transparent"
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
          className="cursor-pointer text-white/90 p-2 rounded-full hover:bg-white/10 border-0 bg-transparent"
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
          className="cursor-pointer text-white/90 p-2 rounded-full hover:bg-white/10 border-0 bg-transparent"
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
  onFavourite,
  onPlay,
  onShare,
}: {
  game: GameFeedItem;
  show: boolean;
  onFavourite: () => void;
  onPlay: () => void;
  onShare: () => void;
}) {
  return (
    <>
      {/* Bottom-left info */}
      <motion.div
        className="absolute bottom-6 left-4 z-50 max-w-[60%]"
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
        className="absolute right-3 bottom-24 z-50 flex flex-col items-center gap-5"
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
  currentIndex,
  total,
  onPrev,
  onNext,
}: {
  canGoPrev: boolean;
  canGoNext: boolean;
  show: boolean;
  currentIndex: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <motion.div
      className="absolute right-3 top-1/2 -translate-y-1/2 z-50 flex-col items-center gap-3 hidden md:flex"
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
