import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../stores/game';
import { useAuthStore } from '../stores/auth';
import { useUIStore } from '../stores/ui';
import { gamesApi, type GameFeedItem } from '../lib/api';
import { GameCard } from '../components/ui/GameCard';
import { SloppyButton } from '../components/ui/SloppyButton';
import { SloppySpinner } from '../components/ui/SloppySpinner';
import { toast } from '../components/ui/SloppyToast';

type Filter = 'all' | 'draft' | 'published';

const FILTER_OPTIONS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Drafts' },
  { value: 'published', label: 'Published' },
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

function EmptyState({ filter }: { filter: Filter }) {
  const navigate = useNavigate();

  const message =
    filter === 'draft'
      ? "You don't have any drafts yet."
      : filter === 'published'
        ? "You haven't published any games yet."
        : "You haven't created any games yet.";

  return (
    <motion.div
      className="flex flex-col items-center justify-center gap-5 py-20"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 200, damping: 20 }}
    >
      <motion.div
        className="text-7xl"
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        🎮
      </motion.div>
      <h2 className="font-heading text-2xl text-sloppy-dark text-center">
        {message}
      </h2>
      <p className="text-sloppy-dark/50 text-center max-w-sm">
        Create your first game and it'll show up here.
      </p>
      <SloppyButton onClick={() => navigate('/create')}>Create a Game</SloppyButton>
    </motion.div>
  );
}

function AuthGate() {
  const { login } = useAuthStore();

  return (
    <motion.div
      className="flex flex-col items-center justify-center gap-5 py-20"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 200, damping: 20 }}
    >
      <motion.div
        className="text-7xl"
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        🔒
      </motion.div>
      <h2 className="font-heading text-2xl text-sloppy-dark text-center">
        Sign in to see your games
      </h2>
      <p className="text-sloppy-dark/50 text-center max-w-sm">
        Sign in to access your drafts and published games.
      </p>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <SloppyButton onClick={() => login('google')} className="w-full">
          Sign in with Google
        </SloppyButton>
        <SloppyButton
          variant="ghost"
          onClick={() => login('anonymous')}
          className="w-full"
        >
          Continue as Guest
        </SloppyButton>
      </div>
    </motion.div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const isDraft = status === 'draft';
  return (
    <span
      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-wobbly ${
        isDraft
          ? 'bg-amber-100 text-amber-700'
          : 'bg-emerald-100 text-emerald-700'
      }`}
    >
      {status}
    </span>
  );
}

function MyGameCard({
  game,
  onPlay,
  onPublish,
}: {
  game: GameFeedItem;
  onPlay: (game: GameFeedItem) => void;
  onPublish: (gameId: string) => void;
}) {
  return (
    <motion.div
      className="bg-white rounded-wobbly-lg p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)] border-2 border-sloppy-dark/5 flex flex-col gap-3 cursor-pointer select-none"
      whileHover={{
        y: -8,
        boxShadow: '6px 10px 0px 0px rgba(0,0,0,0.12)',
      }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      onClick={() => onPlay(game)}
      tabIndex={0}
      role="button"
      aria-label={`Play ${game.title}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onPlay(game);
        }
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-heading text-xl text-sloppy-dark leading-tight">
          {game.title}
        </h3>
        <StatusBadge status={game.status} />
      </div>

      {game.description && (
        <p className="text-sm text-sloppy-dark/60 line-clamp-2">{game.description}</p>
      )}

      <div className="flex items-center justify-between mt-auto pt-2">
        <span className="text-xs text-sloppy-dark/40 font-medium">
          🎮 {game.playCount.toLocaleString()} plays
        </span>

        <div className="flex items-center gap-2">
          {game.status === 'draft' && (
            <motion.button
              className="cursor-pointer px-3 py-2 bg-emerald-500 text-white text-sm font-bold rounded-wobbly shadow-md shadow-emerald-500/20"
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.95 }}
              onClick={(e) => {
                e.stopPropagation();
                onPublish(game.id);
              }}
            >
              Publish
            </motion.button>
          )}
          <motion.button
            className="cursor-pointer px-4 py-2 bg-sloppy-pink text-white text-sm font-bold rounded-wobbly shadow-md shadow-sloppy-pink/20"
            whileHover={{ scale: 1.08, rotate: -1 }}
            whileTap={{ scale: 0.95 }}
            onClick={(e) => {
              e.stopPropagation();
              onPlay(game);
            }}
          >
            Play
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

export default function MyGames() {
  const { myGames, fetchMyGames, favouriteGame, unfavouriteGame } = useGameStore();
  const { isAuthenticated, isLoading: isAuthLoading } = useAuthStore();
  const { openGameOverlay } = useUIStore();
  const navigate = useNavigate();

  const [filter, setFilter] = useState<Filter>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadGames = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await fetchMyGames();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load your games');
    } finally {
      setIsLoading(false);
    }
  }, [fetchMyGames]);

  useEffect(() => {
    if (isAuthenticated) {
      loadGames();
    }
  }, [isAuthenticated, loadGames]);

  const handlePlay = useCallback(
    (game: GameFeedItem) => {
      openGameOverlay(game.id, game);
      navigate(`/game/${game.id}`, { replace: false });
    },
    [openGameOverlay, navigate],
  );

  const handlePublish = useCallback(
    async (gameId: string) => {
      try {
        await gamesApi.publish(gameId);
        toast('Game published!', 'success');
        await fetchMyGames();
      } catch {
        toast('Failed to publish game', 'error');
      }
    },
    [fetchMyGames],
  );

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
        <AuthGate />
      </motion.div>
    );
  }

  const filteredGames =
    filter === 'all'
      ? myGames
      : myGames.filter((g) => g.status === filter);

  const isInitialLoad = isLoading && myGames.length === 0 && !error;
  const showEmpty = !isLoading && filteredGames.length === 0 && !error;
  const showError = !!error && myGames.length === 0;

  return (
    <motion.div
      className="flex flex-col gap-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <div className="flex flex-col gap-3 items-center">
        <h1 className="font-heading text-3xl text-sloppy-dark">My Games</h1>

        {/* Filter tabs */}
        <div className="flex gap-2 justify-center sticky top-0 z-10 py-3 bg-sloppy-cream/90 backdrop-blur-sm w-full">
          {FILTER_OPTIONS.map((opt) => (
            <motion.button
              key={opt.value}
              className={`cursor-pointer px-5 py-2 rounded-wobbly font-heading text-base transition-colors ${
                filter === opt.value
                  ? 'bg-sloppy-pink text-white shadow-md shadow-sloppy-pink/20'
                  : 'bg-white text-sloppy-dark/60 border border-sloppy-dark/10 hover:border-sloppy-pink/40'
              }`}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setFilter(opt.value)}
            >
              {opt.label}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Loading skeletons */}
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
      {showEmpty && <EmptyState filter={filter} />}

      {/* Error state */}
      {showError && (
        <motion.div
          className="flex flex-col items-center justify-center gap-4 py-20"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <span className="text-5xl">💥</span>
          <h2 className="font-heading text-2xl text-sloppy-dark text-center">
            Oops, something broke
          </h2>
          <p className="text-sloppy-dark/50 text-center max-w-sm">{error}</p>
          <SloppyButton onClick={loadGames}>Try Again</SloppyButton>
        </motion.div>
      )}

      {/* Game grid */}
      {filteredGames.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredGames.map((game) => (
            <MyGameCard
              key={game.id}
              game={game}
              onPlay={handlePlay}
              onPublish={handlePublish}
            />
          ))}
        </div>
      )}
    </motion.div>
  );
}
