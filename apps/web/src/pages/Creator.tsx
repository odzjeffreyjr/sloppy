import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { UserX, Gamepad2 } from 'lucide-react';
import { usersApi, creatorGamesApi, type CreatorProfile, type GameFeedItem } from '../lib/api';
import { useAuthStore } from '../stores/auth';
import { useUIStore } from '../stores/ui';
import { useGameStore } from '../stores/game';
import { GameCard } from '../components/ui/GameCard';
import { SloppySpinner } from '../components/ui/SloppySpinner';
import { SloppyButton } from '../components/ui/SloppyButton';

export default function Creator() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { openGameOverlay } = useUIStore();
  const { favouriteGame, unfavouriteGame } = useGameStore();

  const [profile, setProfile] = useState<CreatorProfile | null>(null);
  const [games, setGames] = useState<GameFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      usersApi.getProfile(userId),
      creatorGamesApi.getByCreator(userId, { limit: 50 }),
    ])
      .then(([profileRes, gamesRes]) => {
        if (cancelled) return;
        setProfile(profileRes.data);
        setGames(gamesRes.data);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load profile');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const handlePlay = useCallback(
    (game: GameFeedItem) => {
      openGameOverlay(game.id, game, true);
      navigate(`/game/${game.id}`);
    },
    [openGameOverlay, navigate],
  );

  const isOwnProfile = user?.id === userId;
  const joinDate = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
      })
    : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <SloppySpinner size={48} />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <motion.div
        className="flex flex-col items-center justify-center gap-4 py-20"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <UserX size={48} className="text-sloppy-text-muted" />
        <h2 className="font-heading text-2xl text-sloppy-text text-center">
          Creator not found
        </h2>
        <p className="text-sloppy-text-muted text-center max-w-sm">
          {error ?? 'This profile does not exist.'}
        </p>
        <SloppyButton onClick={() => navigate('/')}>Go Home</SloppyButton>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="max-w-5xl mx-auto"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Profile Header */}
      <motion.div
        className="flex flex-col sm:flex-row items-center sm:items-start gap-5 mb-8"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
      >
        <div className="w-20 h-20 rounded-full bg-sloppy-primary/20 flex items-center justify-center shrink-0">
          <span className="text-3xl font-heading text-sloppy-primary">
            {profile.displayName.charAt(0).toUpperCase()}
          </span>
        </div>

        <div className="flex-1 text-center sm:text-left">
          <h1 className="font-heading text-3xl text-sloppy-text">
            {profile.displayName}
          </h1>
          {joinDate && (
            <p className="text-sloppy-text-muted text-sm mt-1">
              Joined {joinDate}
            </p>
          )}

          <div className="flex gap-6 mt-3 justify-center sm:justify-start">
            <div className="text-center">
              <span className="font-heading text-xl text-sloppy-text block">
                {profile.gameCount}
              </span>
              <span className="text-xs text-sloppy-text-muted">Games</span>
            </div>
            <div className="text-center">
              <span className="font-heading text-xl text-sloppy-text block">
                {profile.totalPlayCount.toLocaleString()}
              </span>
              <span className="text-xs text-sloppy-text-muted">Total Plays</span>
            </div>
          </div>

          {isOwnProfile && (
            <SloppyButton
              variant="ghost"
              className="mt-4"
              onClick={() => navigate('/dashboard/settings')}
            >
              Edit Profile
            </SloppyButton>
          )}
        </div>
      </motion.div>

      {/* Games Grid */}
      <div>
        <h2 className="font-heading text-xl text-sloppy-text mb-4">
          Published Games
        </h2>
        {games.length === 0 ? (
          <motion.div
            className="text-center py-16"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <Gamepad2 size={48} className="text-sloppy-text-muted block mb-3" />
            <p className="text-sloppy-text-muted">
              No published games yet.
            </p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {games.map((game) => (
              <GameCard
                key={game.id}
                game={game}
                onPlay={handlePlay}
                onFavourite={(id) => favouriteGame(id)}
                onUnfavourite={(id) => unfavouriteGame(id)}
              />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
