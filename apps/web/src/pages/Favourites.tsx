import {
  motion,
  useMotionValue,
  useTransform,
  animate,
  AnimatePresence,
} from 'framer-motion';
import { useEffect, useRef, useCallback, useMemo, forwardRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import { HeartCrack, AlertTriangle, Heart } from 'lucide-react';
import { useGameStore } from '../stores/game';
import { useAuthStore } from '../stores/auth';
import { useUIStore } from '../stores/ui';
import { GameCard } from '../components/ui/GameCard';
import { AuthGate } from '../components/ui/AuthGate';
import { SloppyButton } from '../components/ui/SloppyButton';
import { SloppySpinner } from '../components/ui/SloppySpinner';
import type { GameFeedItem, FavouritesSort } from '../lib/api';

const SORT_OPTIONS: { value: FavouritesSort; label: string }[] = [
  { value: 'recent', label: 'Recently Favourited' },
  { value: 'most_played', label: 'Most Played' },
];

function SkeletonCard() {
  return (
    <div className="bg-sloppy-surface rounded-wobbly-lg p-5 border border-sloppy-border flex flex-col gap-3">
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

function EmptyFavourites() {
  const navigate = useNavigate();

  return (
    <motion.div
      className="flex flex-col items-center justify-center gap-5 py-20"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 200, damping: 20 }}
    >
      <HeartCrack size={56} />
      <h2 className="font-heading text-2xl text-sloppy-text text-center">
        No favourites yet!
      </h2>
      <p className="text-sloppy-text-muted text-center max-w-sm">
        Go find some sloppy games and tap the heart to save them here.
      </p>
      <SloppyButton onClick={() => navigate('/')}>Browse Games</SloppyButton>
    </motion.div>
  );
}

// Local AuthGate removed — using shared AuthGate component from ui/AuthGate

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <motion.div
      className="flex flex-col items-center justify-center gap-4 py-20"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <AlertTriangle size={48} className="text-sloppy-text-muted" />
      <h2 className="font-heading text-2xl text-sloppy-text text-center">
        Oops, something broke
      </h2>
      <p className="text-sloppy-text-muted text-center max-w-sm">{message}</p>
      <SloppyButton onClick={onRetry}>Try Again</SloppyButton>
    </motion.div>
  );
}

export default function Favourites() {
  const {
    favouriteGames,
    favouritesSort,
    hasMoreFavourites,
    isLoadingFavourites,
    favouritesError,
    fetchFavourites,
    setFavouritesSort,
    favouriteGame,
    unfavouriteGameWithUndo,
  } = useGameStore();

  const { isAuthenticated, isLoading: isAuthLoading } = useAuthStore();
  const { openGameOverlay } = useUIStore();
  const navigate = useNavigate();
  const virtuosoRef = useRef<VirtuosoHandle>(null);

  const pullY = useMotionValue(0);
  const pullOpacity = useTransform(pullY, [0, 80], [0, 1]);
  const pullRotation = useTransform(pullY, [0, 80], [0, 360]);
  const isPulling = useRef(false);
  const pullStartY = useRef(0);

  useEffect(() => {
    if (isAuthenticated) {
      fetchFavourites(true);
    }
  }, [isAuthenticated, favouritesSort, fetchFavourites]);

  const handlePlay = useCallback(
    (game: GameFeedItem) => {
      openGameOverlay(game.id, game, true);
      navigate(`/game/${game.id}`);
    },
    [openGameOverlay, navigate],
  );

  const handleSortChange = useCallback(
    (sort: FavouritesSort) => {
      setFavouritesSort(sort);
    },
    [setFavouritesSort],
  );

  const loadMore = useCallback(() => {
    if (!isLoadingFavourites && hasMoreFavourites) {
      fetchFavourites();
    }
  }, [isLoadingFavourites, hasMoreFavourites, fetchFavourites]);

  const handleRetry = useCallback(() => {
    fetchFavourites(true);
  }, [fetchFavourites]);

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
      fetchFavourites(true);
    }
    animate(pullY, 0, { type: 'spring', stiffness: 300, damping: 25 });
    isPulling.current = false;
  }, [pullY, fetchFavourites]);

  const itemContent = useCallback(
    (index: number) => {
      const game = favouriteGames[index];
      if (!game) return null;

      return (
        <div className="pb-4">
          <GameCard
            game={game}
            onPlay={handlePlay}
            onFavourite={favouriteGame}
            onUnfavourite={unfavouriteGameWithUndo}
          />
        </div>
      );
    },
    [favouriteGames, handlePlay, favouriteGame, unfavouriteGameWithUndo],
  );

  const footer = useMemo(() => {
    if (isLoadingFavourites && favouriteGames.length > 0) {
      return (
        <div className="flex justify-center py-8">
          <SloppySpinner size={40} />
        </div>
      );
    }
    if (!hasMoreFavourites && favouriteGames.length > 0) {
      return (
        <p className="text-center text-sloppy-text-muted font-heading text-lg py-8">
          That's all your favourites! <Heart size={16} className="inline" />
        </p>
      );
    }
    return null;
  }, [isLoadingFavourites, hasMoreFavourites, favouriteGames.length]);

  if (isAuthLoading) {
    return (
      <motion.div
        className="flex items-center justify-center min-h-[60vh]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <SloppySpinner size={48} />
      </motion.div>
    );
  }

  if (!isAuthenticated) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <AuthGate feature="see your favourites" description="Sign in to save your favourite games and access them anytime." />
      </motion.div>
    );
  }

  const isInitialLoad =
    isLoadingFavourites && favouriteGames.length === 0 && !favouritesError;
  const showEmpty =
    !isLoadingFavourites && favouriteGames.length === 0 && !favouritesError;
  const showError = !!favouritesError && favouriteGames.length === 0;

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

      {/* Header */}
      <div className="flex flex-col gap-3 items-center">
        <h1 className="font-heading text-3xl text-sloppy-text">Favourites</h1>

        {/* Sort tabs */}
        <div className="flex gap-2 justify-center sticky top-0 z-10 py-3 bg-sloppy-bg/90 backdrop-blur-sm w-full">
          {SORT_OPTIONS.map((opt) => (
            <motion.button
              key={opt.value}
              className={`cursor-pointer px-5 py-2 rounded-wobbly font-heading text-base transition-colors ${
                favouritesSort === opt.value
                  ? 'bg-sloppy-primary/15 text-sloppy-primary border border-sloppy-primary/30'
                  : 'text-sloppy-text-muted border border-sloppy-border hover:border-sloppy-primary/30 hover:text-sloppy-text'
              }`}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleSortChange(opt.value)}
            >
              {opt.label}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Initial loading skeletons */}
      <AnimatePresence>
        {isInitialLoad && (
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty state */}
      {showEmpty && <EmptyFavourites />}

      {/* Error state */}
      {showError && <ErrorState message={favouritesError} onRetry={handleRetry} />}

      {/* Favourites list */}
      {favouriteGames.length > 0 && (
        <Virtuoso
          ref={virtuosoRef}
          useWindowScroll
          data={favouriteGames}
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
