import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Gamepad2, AlertTriangle } from 'lucide-react';
import { useGameStore } from '../stores/game';
import { useAuthStore } from '../stores/auth';
import { useUIStore } from '../stores/ui';
import { gamesApi, type GameFeedItem } from '../lib/api';
import { SloppyButton } from '../components/ui/SloppyButton';
import { SloppySpinner } from '../components/ui/SloppySpinner';
import { AuthGate } from '../components/ui/AuthGate';
import { toast } from '../components/ui/SloppyToast';

type Filter = 'all' | 'draft' | 'published';

const FILTER_OPTIONS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Drafts' },
  { value: 'published', label: 'Published' },
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
        className="text-sloppy-text-muted"
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <Gamepad2 size={56} />
      </motion.div>
      <h2 className="font-heading text-2xl text-sloppy-text text-center">
        {message}
      </h2>
      <p className="text-sloppy-text-muted text-center max-w-sm">
        Create your first game and it'll show up here.
      </p>
      <SloppyButton onClick={() => navigate('/create')}>Create a Game</SloppyButton>
    </motion.div>
  );
}


function StatusBadge({ status }: { status: string }) {
  const isDraft = status === 'draft';
  return (
    <span
      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-wobbly ${
        isDraft
          ? 'bg-sloppy-warning/20 text-sloppy-warning'
          : 'bg-sloppy-success/20 text-sloppy-success'
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
  onRegenThumbnail,
  onDelete,
}: {
  game: GameFeedItem;
  onPlay: (game: GameFeedItem) => void;
  onPublish: (gameId: string) => void;
  onRegenThumbnail: (gameId: string) => void;
  onDelete: (gameId: string) => void;
}) {
  const thumb = game.thumbnailSmUrl || game.thumbnailUrl;
  const lastPlayed = game.updatedAt
    ? new Date(game.updatedAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })
    : null;

  return (
    <motion.div
      className="bg-sloppy-surface rounded-wobbly-lg overflow-hidden border border-sloppy-border flex flex-col cursor-pointer select-none hover:border-sloppy-primary/30 transition-colors"
      whileHover={{
        y: -4,
        boxShadow: '0 8px 24px rgba(255, 110, 180, 0.12)',
      }}
      whileTap={{ scale: 0.98 }}
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
      {/* Thumbnail */}
      <div className="relative aspect-video bg-sloppy-surface-hover overflow-hidden">
        {thumb ? (
          <img
            src={thumb}
            alt={game.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Gamepad2 size={32} className="text-sloppy-text-muted opacity-20" />
          </div>
        )}

        <div className="absolute top-2 right-2">
          <StatusBadge status={game.status} />
        </div>
      </div>

      {/* Info */}
      <div className="p-3 sm:p-4 flex flex-col gap-1.5 flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-heading text-base text-sloppy-text leading-tight line-clamp-1">
            {game.title}
          </h3>
          {lastPlayed && (
            <span className="text-[10px] text-sloppy-text-muted whitespace-nowrap shrink-0">{lastPlayed}</span>
          )}
        </div>

        {game.description && (
          <p className="text-xs text-sloppy-text-muted line-clamp-1">
            {game.description}
          </p>
        )}

        {/* Stats row */}
        <div className="flex items-center gap-3 text-xs text-sloppy-text-muted mt-auto pt-1">
          <span className="flex items-center gap-1">
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <circle cx="12" cy="12" r="10" />
            </svg>
            {game.playCount.toLocaleString()}
          </span>
          <span className="flex items-center gap-1">
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor" stroke="none">
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
            </svg>
            {(game.favouriteCount ?? 0).toLocaleString()}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 pt-1.5 flex-wrap">
          {game.status === 'draft' && (
            <motion.button
              className="cursor-pointer px-2.5 py-1 bg-sloppy-success text-white text-[11px] font-bold rounded-full shadow-md shadow-sloppy-success/20 border-0"
              whileHover={{ scale: 1.05 }}
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
            className="cursor-pointer p-1.5 bg-sloppy-surface-hover text-sloppy-text-muted rounded-full border border-sloppy-border hover:text-sloppy-text transition-colors"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={(e) => {
              e.stopPropagation();
              onRegenThumbnail(game.id);
            }}
            title="Regenerate thumbnail"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
            </svg>
          </motion.button>
          {game.status === 'draft' && (
            <motion.button
              className="cursor-pointer p-1.5 bg-sloppy-surface-hover text-sloppy-text-muted rounded-full border border-sloppy-border hover:text-red-400 transition-colors"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={(e) => {
                e.stopPropagation();
                onDelete(game.id);
              }}
              title="Delete draft"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
              </svg>
            </motion.button>
          )}
          <motion.button
            className="cursor-pointer ml-auto px-3 py-1 bg-sloppy-primary text-white text-[11px] font-bold rounded-full shadow-md shadow-sloppy-primary/20 border-0"
            whileHover={{ scale: 1.05 }}
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
  const { myGames, fetchMyGames, deleteGame } = useGameStore();
  const { isAuthenticated, isLoading: isAuthLoading } = useAuthStore();
  const { openGameOverlay } = useUIStore();
  const navigate = useNavigate();

  const [filter, setFilter] = useState<Filter>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; title: string } | null>(null);

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
      openGameOverlay(game.id, game, true);
      navigate(`/game/${game.id}`);
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

  const handleRegenThumbnail = useCallback(
    async (gameId: string) => {
      toast('Regenerating thumbnail...', 'info');
      try {
        await gamesApi.regenerateThumbnail(gameId);
        toast('Thumbnail regenerated!', 'success');
        await fetchMyGames();
      } catch {
        toast('Failed to regenerate thumbnail', 'error');
      }
    },
    [fetchMyGames],
  );

  const handleDeleteRequest = useCallback(
    (gameId: string) => {
      const game = myGames.find((g) => g.id === gameId);
      setDeleteConfirm({ id: gameId, title: game?.title ?? 'this game' });
    },
    [myGames],
  );

  const confirmDelete = useCallback(async () => {
    if (!deleteConfirm) return;
    await deleteGame(deleteConfirm.id);
    setDeleteConfirm(null);
  }, [deleteConfirm, deleteGame]);

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
        <AuthGate feature="see your games" description="Sign in to access your drafts and published games." />
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="font-heading text-3xl text-sloppy-text">My Games</h1>

        <div className="flex gap-2">
          {FILTER_OPTIONS.map((opt) => (
            <motion.button
              key={opt.value}
              className={`cursor-pointer px-4 py-2 rounded-wobbly font-body text-sm font-medium transition-colors ${
                filter === opt.value
                  ? 'bg-sloppy-primary/15 text-sloppy-primary border border-sloppy-primary/30'
                  : 'text-sloppy-text-muted border border-sloppy-border hover:border-sloppy-primary/30 hover:text-sloppy-text'
              }`}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
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
          <AlertTriangle size={48} className="text-sloppy-text-muted" />
          <h2 className="font-heading text-2xl text-sloppy-text text-center">
            Oops, something broke
          </h2>
          <p className="text-sloppy-text-muted text-center max-w-sm">{error}</p>
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
              onRegenThumbnail={handleRegenThumbnail}
              onDelete={handleDeleteRequest}
            />
          ))}
        </div>
      )}

      {/* Delete confirmation dialog */}
      <AnimatePresence>
        {deleteConfirm && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setDeleteConfirm(null)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
            <motion.div
              className="relative z-10 w-full max-w-sm glass rounded-wobbly-lg p-6 shadow-2xl border border-sloppy-border"
              initial={{ scale: 0.9, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, y: 20, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            >
              <h3 className="font-heading text-lg text-sloppy-text mb-2">
                Delete draft?
              </h3>
              <p className="text-sm text-sloppy-text-muted mb-5">
                <span className="font-semibold text-sloppy-text">{deleteConfirm.title}</span> will
                be permanently deleted. This cannot be undone.
              </p>
              <div className="flex justify-end gap-3">
                <motion.button
                  className="cursor-pointer px-4 py-2 rounded-wobbly text-sm font-medium text-sloppy-text-muted border border-sloppy-border hover:border-sloppy-primary/30 transition-colors"
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setDeleteConfirm(null)}
                >
                  Cancel
                </motion.button>
                <motion.button
                  className="cursor-pointer px-4 py-2 rounded-wobbly text-sm font-bold text-white bg-red-500 hover:bg-red-600 transition-colors"
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={confirmDelete}
                >
                  Delete
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
