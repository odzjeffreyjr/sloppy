import { motion } from 'framer-motion';
import { useEffect, useCallback, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGameStore } from '../stores/game';
import { useUIStore } from '../stores/ui';
import { GameCard } from '../components/ui/GameCard';
import { GameCardSkeletonGrid } from '../components/ui/GameCardSkeleton';
import { SloppySpinner } from '../components/ui/SloppySpinner';
import type { GameFeedItem } from '../lib/api';

const GENRE_INFO: Record<string, { label: string; icon: string }> = {
  '2d-platformer': { label: 'Platformer', icon: '🏃' },
  '2d-topdown': { label: 'Top-Down', icon: '🗺️' },
  '2d-puzzle': { label: 'Puzzle', icon: '🧩' },
  '2d-arcade': { label: 'Arcade', icon: '🕹️' },
  '2d-shooter': { label: 'Shooter', icon: '🔫' },
  '2d-tower-defense': { label: 'Tower Defense', icon: '🏰' },
  '2d-endless-runner': { label: 'Runner', icon: '🏃‍♂️' },
  '2d-rhythm': { label: 'Rhythm', icon: '🎵' },
  '2d-cards': { label: 'Cards', icon: '🃏' },
  '2d-idle': { label: 'Idle', icon: '⏳' },
  '3d-racing': { label: 'Racing', icon: '🏎️' },
  '3d-firstperson': { label: 'FPS', icon: '🎯' },
  '3d-puzzle': { label: '3D Puzzle', icon: '🔮' },
  '3d-thirdperson': { label: '3D Runner', icon: '🏃‍♂️' },
  '3d-flight': { label: 'Flight', icon: '✈️' },
  '3d-platformer': { label: '3D Platformer', icon: '🌀' },
  '2d-custom': { label: 'Custom 2D', icon: '🎨' },
  '3d-custom': { label: 'Custom 3D', icon: '🎨' },
};

type SortOption = 'popular' | 'newest' | 'trending';

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'popular', label: 'Popular' },
  { value: 'newest', label: 'New' },
  { value: 'trending', label: 'Trending' },
];

export default function Category() {
  const { genre } = useParams<{ genre: string }>();
  const navigate = useNavigate();
  const { openGameOverlay } = useUIStore();
  const {
    categoryGames,
    hasMoreCategory,
    isLoadingCategory,
    fetchByGenre,
    favouriteGame,
    unfavouriteGame,
  } = useGameStore();

  const [sort, setSort] = useState<SortOption>('popular');

  useEffect(() => {
    if (!genre) return;
    fetchByGenre(genre, true, sort);
  }, [genre, sort, fetchByGenre]);

  const handlePlay = useCallback(
    (game: GameFeedItem) => {
      openGameOverlay(game.id, game);
      navigate(`/game/${game.id}`);
    },
    [openGameOverlay, navigate],
  );

  const loadMore = useCallback(() => {
    if (!isLoadingCategory && hasMoreCategory && genre) {
      fetchByGenre(genre, false, sort);
    }
  }, [isLoadingCategory, hasMoreCategory, genre, sort, fetchByGenre]);

  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (observerRef.current) observerRef.current.disconnect();
      if (!node) return;
      observerRef.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) loadMore();
      });
      observerRef.current.observe(node);
    },
    [loadMore],
  );

  const info = genre ? GENRE_INFO[genre] : null;
  const isInitialLoad = isLoadingCategory && categoryGames.length === 0;
  const showEmpty = !isLoadingCategory && categoryGames.length === 0;

  return (
    <motion.div
      className="space-y-5 pb-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <motion.button
            className="cursor-pointer p-2 rounded-wobbly bg-sloppy-surface border border-sloppy-border text-sloppy-text-muted hover:text-sloppy-text hover:bg-sloppy-surface-hover transition-colors"
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate(-1)}
            aria-label="Go back"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </motion.button>
          <div className="flex items-center gap-2">
            {info && <span className="text-3xl">{info.icon}</span>}
            <h1 className="font-heading text-2xl text-sloppy-text">
              {info?.label ?? genre ?? 'Category'}
            </h1>
          </div>
        </div>

        {/* Sort tabs */}
        <div className="flex gap-2">
          {SORT_OPTIONS.map((opt) => (
            <motion.button
              key={opt.value}
              className={`cursor-pointer px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                sort === opt.value
                  ? 'bg-sloppy-primary text-white border-sloppy-primary'
                  : 'bg-sloppy-surface text-sloppy-text-muted border-sloppy-border hover:border-sloppy-primary/30'
              }`}
              whileTap={{ scale: 0.95 }}
              onClick={() => setSort(opt.value)}
            >
              {opt.label}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {isInitialLoad && <GameCardSkeletonGrid count={8} />}

      {/* Grid */}
      {categoryGames.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {categoryGames.map((game) => (
            <GameCard
              key={game.id}
              game={game}
              onPlay={handlePlay}
              onFavourite={favouriteGame}
              onUnfavourite={unfavouriteGame}
            />
          ))}
        </div>
      )}

      {/* Infinite scroll sentinel */}
      {hasMoreCategory && categoryGames.length > 0 && (
        <div ref={sentinelRef} className="flex justify-center py-6">
          {isLoadingCategory && <SloppySpinner size={32} />}
        </div>
      )}

      {/* No more */}
      {!hasMoreCategory && categoryGames.length > 0 && (
        <p className="text-center text-sloppy-text-muted/50 font-heading text-sm py-4">
          That's everything!
        </p>
      )}

      {/* Empty */}
      {showEmpty && (
        <motion.div
          className="flex flex-col items-center justify-center gap-4 py-16"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <span className="text-5xl">🎮</span>
          <h2 className="font-heading text-xl text-sloppy-text text-center">
            No {info?.label ?? 'games'} yet
          </h2>
          <p className="text-sloppy-text-muted text-center max-w-sm text-sm">
            Be the first to create a {info?.label?.toLowerCase() ?? ''} game!
          </p>
          <motion.button
            className="cursor-pointer px-6 py-2.5 bg-sloppy-primary text-white font-semibold rounded-wobbly border-0"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/create')}
          >
            Create a Game
          </motion.button>
        </motion.div>
      )}
    </motion.div>
  );
}
