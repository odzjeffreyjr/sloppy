import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { useEffect, useRef, useCallback, useMemo, forwardRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import { useGameStore } from '../stores/game';
import { useUIStore } from '../stores/ui';
import { GameCard } from '../components/ui/GameCard';
import { SloppyButton } from '../components/ui/SloppyButton';
import { SloppySpinner } from '../components/ui/SloppySpinner';
import type { GameFeedItem, FeedSort } from '../lib/api';

const CDN_URL = import.meta.env.VITE_CDN_URL ?? '';

const SORT_OPTIONS: { value: FeedSort; label: string }[] = [
  { value: 'recent', label: 'Recent' },
  { value: 'popular', label: 'Popular' },
  { value: 'random', label: 'Random' },
];

function SkeletonCard() {
  return (
    <div className="bg-white rounded-wobbly-lg p-5 border-2 border-sloppy-dark/5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="skeleton-shimmer rounded-wobbly h-6 w-3/5" />
        <div className="skeleton-shimmer rounded-full h-8 w-8 shrink-0" />
      </div>
      <div className="skeleton-shimmer rounded-wobbly h-4 w-full" />
      <div className="skeleton-shimmer rounded-wobbly h-4 w-4/5" />
      <div className="flex items-center justify-between mt-auto pt-2">
        <div className="skeleton-shimmer rounded-wobbly h-4 w-20" />
        <div className="skeleton-shimmer rounded-wobbly h-9 w-16" />
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <motion.div
      className="flex flex-col items-center justify-center gap-4 py-20"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 200, damping: 20 }}
    >
      <span className="text-6xl">🎮</span>
      <h2 className="font-heading text-2xl text-sloppy-dark text-center">
        No games yet!
      </h2>
      <p className="text-sloppy-dark/50 text-center max-w-sm">
        Go create something sloppy — be the first to launch a game on the feed.
      </p>
    </motion.div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <motion.div
      className="flex flex-col items-center justify-center gap-4 py-20"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <span className="text-5xl">💥</span>
      <h2 className="font-heading text-2xl text-sloppy-dark text-center">
        Oops, something broke
      </h2>
      <p className="text-sloppy-dark/50 text-center max-w-sm">{message}</p>
      <SloppyButton onClick={onRetry}>Try Again</SloppyButton>
    </motion.div>
  );
}

export default function Home() {
  const {
    feedGames,
    feedSort,
    hasMore,
    isLoadingFeed,
    feedError,
    fetchFeed,
    setFeedSort,
    favouriteGame,
    unfavouriteGame,
  } = useGameStore();

  const { openGameOverlay } = useUIStore();
  const navigate = useNavigate();
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const preloadedUrls = useRef<Set<string>>(new Set());

  // Pull-to-refresh
  const pullY = useMotionValue(0);
  const pullOpacity = useTransform(pullY, [0, 80], [0, 1]);
  const pullRotation = useTransform(pullY, [0, 80], [0, 360]);
  const isPulling = useRef(false);
  const pullStartY = useRef(0);

  useEffect(() => {
    fetchFeed(true);
  }, [feedSort, fetchFeed]);

  const handlePlay = useCallback(
    (game: GameFeedItem) => {
      openGameOverlay(game.id, game);
      navigate(`/game/${game.id}`, { replace: false });
    },
    [openGameOverlay, navigate],
  );

  const handleSortChange = useCallback(
    (sort: FeedSort) => {
      setFeedSort(sort);
    },
    [setFeedSort],
  );

  const loadMore = useCallback(() => {
    if (!isLoadingFeed && hasMore) {
      fetchFeed();
    }
  }, [isLoadingFeed, hasMore, fetchFeed]);

  const handleRetry = useCallback(() => {
    fetchFeed(true);
  }, [fetchFeed]);

  // Preload game assets when cards come near viewport
  const preloadGame = useCallback((game: GameFeedItem) => {
    if (!CDN_URL || !game.storagePath) return;
    const url = `${CDN_URL}/${game.storagePath}/index.html`;
    if (preloadedUrls.current.has(url)) return;

    if (preloadedUrls.current.size >= 2) {
      const oldest = preloadedUrls.current.values().next().value;
      if (oldest) {
        preloadedUrls.current.delete(oldest);
        const existing = document.querySelector(`link[href="${oldest}"]`);
        existing?.remove();
      }
    }

    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = url;
    document.head.appendChild(link);
    preloadedUrls.current.add(url);
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (window.scrollY === 0) {
      pullStartY.current = e.touches[0].clientY;
      isPulling.current = true;
    }
  }, []);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isPulling.current) return;
      const delta = e.touches[0].clientY - pullStartY.current;
      if (delta > 0 && window.scrollY === 0) {
        pullY.set(Math.min(delta * 0.5, 100));
      }
    },
    [pullY],
  );

  const handleTouchEnd = useCallback(() => {
    if (pullY.get() > 60) {
      fetchFeed(true);
    }
    animate(pullY, 0, { type: 'spring', stiffness: 300, damping: 25 });
    isPulling.current = false;
  }, [pullY, fetchFeed]);

  const isInitialLoad = isLoadingFeed && feedGames.length === 0 && !feedError;
  const showEmpty = !isLoadingFeed && feedGames.length === 0 && !feedError;
  const showError = !!feedError && feedGames.length === 0;

  const itemContent = useCallback(
    (index: number) => {
      const game = feedGames[index];
      if (!game) return null;

      // Preload next 2 games
      if (index < feedGames.length - 1) {
        const next = feedGames[index + 1];
        if (next) preloadGame(next);
      }
      if (index < feedGames.length - 2) {
        const nextNext = feedGames[index + 2];
        if (nextNext) preloadGame(nextNext);
      }

      return (
        <div className="pb-4">
          <GameCard
            game={game}
            onPlay={handlePlay}
            onFavourite={favouriteGame}
            onUnfavourite={unfavouriteGame}
          />
        </div>
      );
    },
    [feedGames, handlePlay, favouriteGame, unfavouriteGame, preloadGame],
  );

  const footer = useMemo(() => {
    if (isLoadingFeed && feedGames.length > 0) {
      return (
        <div className="flex justify-center py-8">
          <SloppySpinner size={40} />
        </div>
      );
    }
    if (!hasMore && feedGames.length > 0) {
      return (
        <p className="text-center text-sloppy-dark/30 font-heading text-lg py-8">
          That's all the games for now! 🎉
        </p>
      );
    }
    return null;
  }, [isLoadingFeed, hasMore, feedGames.length]);

  return (
    <motion.div
      className="flex flex-col gap-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull-to-refresh indicator */}
      <motion.div
        className="flex justify-center -mt-2 overflow-hidden"
        style={{ opacity: pullOpacity, height: pullY }}
      >
        <motion.div style={{ rotate: pullRotation }}>
          <SloppySpinner size={32} />
        </motion.div>
      </motion.div>

      {/* Sort tabs */}
      <div className="flex gap-2 justify-center sticky top-0 z-10 py-3 bg-sloppy-cream/90 backdrop-blur-sm">
        {SORT_OPTIONS.map((opt) => (
          <motion.button
            key={opt.value}
            className={`cursor-pointer px-5 py-2 rounded-wobbly font-heading text-base transition-colors ${
              feedSort === opt.value
                ? 'bg-sloppy-pink text-white shadow-md shadow-sloppy-pink/20'
                : 'bg-white text-sloppy-dark/60 border border-sloppy-dark/10 hover:border-sloppy-pink/40'
            }`}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleSortChange(opt.value)}
          >
            {opt.label}
          </motion.button>
        ))}
      </div>

      {/* Initial loading skeletons */}
      {isInitialLoad && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {showEmpty && <EmptyState />}

      {/* Error state */}
      {showError && <ErrorState message={feedError} onRetry={handleRetry} />}

      {/* Game feed */}
      {feedGames.length > 0 && (
        <Virtuoso
          ref={virtuosoRef}
          useWindowScroll
          data={feedGames}
          endReached={loadMore}
          overscan={400}
          itemContent={(index) => itemContent(index)}
          components={{
            Footer: () => <>{footer}</>,
            List: VirtuosoList,
          }}
        />
      )}
    </motion.div>
  );
}

const VirtuosoList = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  (props, ref) => (
    <div
      ref={ref}
      {...props}
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4"
    />
  ),
);
VirtuosoList.displayName = 'VirtuosoList';
