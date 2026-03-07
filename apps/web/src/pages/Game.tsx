import { motion } from 'framer-motion';
import { useEffect, useRef, useCallback, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { FileQuestion } from 'lucide-react';
import { useUIStore } from '../stores/ui';
import { useGameStore } from '../stores/game';
import { useMultiplayerStore } from '../stores/multiplayer';
import { gamesApi, type GameFeedItem } from '../lib/api';
import { SectionRow } from '../components/ui/SectionRow';
import { GameCard } from '../components/ui/GameCard';
import { SloppySpinner } from '../components/ui/SloppySpinner';
import { AdSlot } from '../components/ui/AdSlot';
import { SloppyButton } from '../components/ui/SloppyButton';

export default function Game() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isGameOverlayOpen, openGameOverlay, gameOverlayData } = useUIStore();
  const { joinSession, openModal } = useMultiplayerStore();
  const {
    currentGame,
    setCurrentGame,
    favouriteGame,
    unfavouriteGame,
    categoryGames,
    fetchByGenre,
  } = useGameStore();

  const hasAutoJoined = useRef(false);
  const [game, setGame] = useState<GameFeedItem | null>(gameOverlayData ?? currentGame);
  const [loading, setLoading] = useState(!game);

  const sessionId = searchParams.get('session');

  // Fetch game data if not already available
  useEffect(() => {
    if (!id) return;

    if (gameOverlayData && gameOverlayData.id === id) {
      setGame(gameOverlayData);
      setCurrentGame(gameOverlayData);
      setLoading(false);
      return;
    }

    setLoading(true);
    gamesApi.get(id).then((res) => {
      setGame(res.data);
      setCurrentGame(res.data);
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });
  }, [id, gameOverlayData, setCurrentGame]);

  // Fetch related games by genre
  useEffect(() => {
    if (game?.genre) {
      fetchByGenre(game.genre, true);
    }
  }, [game?.genre, fetchByGenre]);

  // Auto-join a multiplayer session when ?session= is present
  useEffect(() => {
    if (sessionId && isGameOverlayOpen && !hasAutoJoined.current) {
      hasAutoJoined.current = true;
      openModal();
      joinSession(sessionId);
    }
  }, [sessionId, isGameOverlayOpen, joinSession, openModal]);

  // Escape key to go back when not in overlay
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isGameOverlayOpen) {
        navigate(-1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate, isGameOverlayOpen]);

  const handlePlay = useCallback(
    (g: GameFeedItem) => {
      openGameOverlay(g.id, g, true);
      navigate(`/game/${g.id}`, { replace: true });
    },
    [openGameOverlay, navigate],
  );

  const handlePlayCurrent = useCallback(() => {
    if (!game) return;
    openGameOverlay(game.id, game);
  }, [game, openGameOverlay]);

  const handleFavouriteToggle = useCallback(() => {
    if (!game) return;
    if (game.isFavourited) {
      unfavouriteGame(game.id);
      setGame({ ...game, isFavourited: false });
    } else {
      favouriteGame(game.id);
      setGame({ ...game, isFavourited: true });
    }
  }, [game, favouriteGame, unfavouriteGame]);

  // If overlay is showing, render nothing (overlay handles display)
  if (isGameOverlayOpen) return null;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <SloppySpinner size={64} />
      </div>
    );
  }

  if (!game) {
    return (
      <motion.div
        className="flex flex-col items-center justify-center gap-4 py-20"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <FileQuestion size={48} className="text-sloppy-text-muted" />
        <h2 className="font-heading text-2xl text-sloppy-text">Game not found</h2>
        <SloppyButton onClick={() => navigate('/')}>Go Home</SloppyButton>
      </motion.div>
    );
  }

  const relatedGames = categoryGames.filter((g) => g.id !== game.id).slice(0, 8);

  return (
    <motion.div
      className="space-y-6 pb-8"
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
          <h1 className="font-heading text-2xl text-sloppy-text line-clamp-1">{game.title}</h1>
        </div>

        <div className="flex items-center gap-2">
          <motion.button
            className={`cursor-pointer p-2 rounded-wobbly border transition-colors ${
              game.isFavourited
                ? 'bg-sloppy-danger/15 border-sloppy-danger/30 text-sloppy-danger'
                : 'bg-sloppy-surface border-sloppy-border text-sloppy-text-muted hover:text-sloppy-danger hover:border-sloppy-danger/30'
            }`}
            whileTap={{ scale: 0.9 }}
            onClick={handleFavouriteToggle}
            aria-label={game.isFavourited ? 'Unfavourite' : 'Favourite'}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill={game.isFavourited ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2}>
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
            </svg>
          </motion.button>

          {game.supportsMultiplayer && (
            <motion.button
              className="cursor-pointer p-2 rounded-wobbly bg-sloppy-surface border border-sloppy-border text-sloppy-text-muted hover:text-sloppy-primary hover:border-sloppy-primary/30 transition-colors"
              whileTap={{ scale: 0.9 }}
              onClick={() => openModal()}
              aria-label="Multiplayer"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
              </svg>
            </motion.button>
          )}

          <motion.button
            className="cursor-pointer inline-flex items-center gap-2 px-5 py-2 bg-sloppy-primary text-white font-semibold rounded-wobbly border-0 shadow-lg shadow-sloppy-primary/20"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={handlePlayCurrent}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
            Play
          </motion.button>
        </div>
      </div>

      {/* Game thumbnail preview */}
      <div
        className="relative w-full aspect-video rounded-wobbly-lg overflow-hidden bg-black border border-sloppy-border cursor-pointer group"
        onClick={handlePlayCurrent}
      >
        {game.thumbnailUrl ? (
          <img
            src={game.thumbnailUrl}
            alt={game.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-sloppy-primary/20 to-sloppy-secondary/20 flex items-center justify-center">
            <svg className="w-16 h-16 text-sloppy-text-muted/20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <rect x="2" y="6" width="20" height="12" rx="4" />
              <path d="M6 12h4M8 10v4" />
              <circle cx="16" cy="10" r="1" fill="currentColor" />
              <circle cx="18" cy="12" r="1" fill="currentColor" />
            </svg>
          </div>
        )}
        <div className="absolute inset-0 bg-black/30 group-hover:bg-black/50 transition-colors flex items-center justify-center">
          <motion.div
            className="w-16 h-16 rounded-full bg-sloppy-primary/90 flex items-center justify-center shadow-2xl shadow-sloppy-primary/40"
            whileHover={{ scale: 1.1 }}
          >
            <svg className="w-7 h-7 text-white ml-1" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </motion.div>
        </div>
      </div>

      {/* Game info */}
      <div className="glass rounded-wobbly-lg p-5 border border-sloppy-border space-y-4">
        {game.description && (
          <p className="text-sloppy-text-muted text-sm leading-relaxed">{game.description}</p>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Stat label="Plays" value={game.playCount.toLocaleString()} />
          <Stat label="Favourites" value={(game.favouriteCount ?? 0).toLocaleString()} />
          <Stat label="Created" value={new Date(game.createdAt).toLocaleDateString()} />
          <Stat label="Creator" value={game.creatorDisplayName || 'Anonymous'} />
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-2">
          {game.genre && (
            <span className="px-3 py-1 text-xs font-medium rounded-full bg-sloppy-primary/15 text-sloppy-primary">
              {game.genre}
            </span>
          )}
          {game.engine && (
            <span className="px-3 py-1 text-xs font-medium rounded-full bg-sloppy-secondary/15 text-sloppy-secondary">
              {game.engine}
            </span>
          )}
          {game.supportsMultiplayer && (
            <span className="px-3 py-1 text-xs font-medium rounded-full bg-sloppy-success/15 text-sloppy-success">
              Multiplayer
            </span>
          )}
        </div>
      </div>

      {/* Ad: medium rectangle below game info */}
      <div className="flex justify-center">
        <AdSlot format="rectangle" gameId={game.id} creatorId={game.creatorId} />
      </div>

      {/* Related games */}
      {relatedGames.length > 0 && (
        <SectionRow
          title="More Like This"
          onViewAll={game.genre ? () => navigate(`/category/${game.genre}`) : undefined}
        >
          {relatedGames.map((g) => (
            <div key={g.id} className="shrink-0 w-[220px] sm:w-[260px]">
              <GameCard
                game={g}
                onPlay={handlePlay}
                onFavourite={favouriteGame}
                onUnfavourite={unfavouriteGame}
              />
            </div>
          ))}
        </SectionRow>
      )}
    </motion.div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <div className="font-heading text-lg text-sloppy-text">{value}</div>
      <div className="text-xs text-sloppy-text-muted">{label}</div>
    </div>
  );
}
