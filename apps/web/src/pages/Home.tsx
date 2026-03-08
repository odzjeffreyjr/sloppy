import { motion } from 'framer-motion';
import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Footprints, Map, Puzzle, Joystick, Crosshair, Castle, Music, Spade, Timer, Car, Target, Wand2, Plane, Shapes, Gamepad2 } from 'lucide-react';
import { useGameStore } from '../stores/game';
import { useUIStore } from '../stores/ui';
import { HeroBanner } from '../components/ui/HeroBanner';
import { SectionRow } from '../components/ui/SectionRow';
import { CategoryChip, CategoryChipRow } from '../components/ui/CategoryChip';
import { GameCard } from '../components/ui/GameCard';
import { GameCardSkeleton } from '../components/ui/GameCardSkeleton';
import { AdSlot } from '../components/ui/AdSlot';
import { SloppyButton } from '../components/ui/SloppyButton';
import type { GameFeedItem } from '../lib/api';

const GENRE_CATEGORIES: { value: string; label: string; icon: React.ReactNode }[] = [
  { value: '2d-platformer', label: 'Platformer', icon: <Footprints size={18} /> },
  { value: '2d-topdown', label: 'Top-Down', icon: <Map size={18} /> },
  { value: '2d-puzzle', label: 'Puzzle', icon: <Puzzle size={18} /> },
  { value: '2d-arcade', label: 'Arcade', icon: <Joystick size={18} /> },
  { value: '2d-shooter', label: 'Shooter', icon: <Crosshair size={18} /> },
  { value: '2d-tower-defense', label: 'Tower Defense', icon: <Castle size={18} /> },
  { value: '2d-endless-runner', label: 'Runner', icon: <Footprints size={18} /> },
  { value: '2d-rhythm', label: 'Rhythm', icon: <Music size={18} /> },
  { value: '2d-cards', label: 'Cards', icon: <Spade size={18} /> },
  { value: '2d-idle', label: 'Idle', icon: <Timer size={18} /> },
  { value: '3d-racing', label: 'Racing', icon: <Car size={18} /> },
  { value: '3d-firstperson', label: 'FPS', icon: <Target size={18} /> },
  { value: '3d-puzzle', label: '3D Puzzle', icon: <Wand2 size={18} /> },
  { value: '3d-flight', label: 'Flight', icon: <Plane size={18} /> },
  { value: '3d-platformer', label: '3D Platformer', icon: <Shapes size={18} /> },
];

function SectionSkeleton() {
  return (
    <div className="space-y-3">
      <div className="h-6 w-40 rounded skeleton-shimmer" />
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="shrink-0 w-[220px] sm:w-[260px]">
            <GameCardSkeleton />
          </div>
        ))}
      </div>
    </div>
  );
}

function GameCardRow({ games, onPlay, onFavourite, onUnfavourite }: {
  games: GameFeedItem[];
  onPlay: (g: GameFeedItem) => void;
  onFavourite: (id: string) => void;
  onUnfavourite: (id: string) => void;
}) {
  return (
    <>
      {games.map((game) => (
        <div key={game.id} className="shrink-0 w-[220px] sm:w-[260px]">
          <GameCard
            game={game}
            onPlay={onPlay}
            onFavourite={onFavourite}
            onUnfavourite={onUnfavourite}
          />
        </div>
      ))}
    </>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const { openGameOverlay } = useUIStore();
  const {
    feedGames,
    isLoadingFeed,
    fetchFeed,
    favouriteGame,
    unfavouriteGame,
    trendingGames,
    isLoadingTrending,
    featuredGames,
    isLoadingFeatured,
    fetchTrending,
    fetchFeatured,
  } = useGameStore();

  useEffect(() => {
    fetchFeatured();
    fetchTrending();
    fetchFeed(true);
  }, [fetchFeatured, fetchTrending, fetchFeed]);

  // Auto-refresh "Just Created" section every 30s
  useEffect(() => {
    const timer = setInterval(() => {
      fetchFeed(true);
    }, 30_000);
    return () => clearInterval(timer);
  }, [fetchFeed]);

  const handlePlay = useCallback(
    (game: GameFeedItem) => {
      openGameOverlay(game.id, game, true);
      navigate(`/game/${game.id}`);
    },
    [openGameOverlay, navigate],
  );

  const handleCategoryClick = useCallback(
    (genre: string) => {
      navigate(`/category/${genre}`);
    },
    [navigate],
  );

  const handleViewAll = useCallback(
    (filter: string) => {
      navigate(`/explore?${filter}`);
    },
    [navigate],
  );

  const justCreated = feedGames.filter((g) => g.status === 'published').slice(0, 8);
  const threeD = feedGames.filter((g) => g.engine === 'threejs').slice(0, 8);
  const multiplayer = feedGames.filter((g) => g.supportsMultiplayer).slice(0, 8);

  const isInitialLoad = isLoadingFeed && feedGames.length === 0;

  return (
    <motion.div
      className="space-y-8 pb-8 min-w-0"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Hero Banner */}
      {isLoadingFeatured && featuredGames.length === 0 ? (
        <div className="aspect-[21/9] md:aspect-[3/1] rounded-wobbly-lg skeleton-shimmer" />
      ) : (
        featuredGames.length > 0 && (
          <HeroBanner
            games={featuredGames}
            onPlay={handlePlay}
          />
        )
      )}

      {/* Category Quick Access */}
      <CategoryChipRow>
        {GENRE_CATEGORIES.map((cat) => (
          <CategoryChip
            key={cat.value}
            label={cat.label}
            icon={cat.icon}
            onClick={() => handleCategoryClick(cat.value)}
          />
        ))}
      </CategoryChipRow>

      {/* Trending Now */}
      {isLoadingTrending && trendingGames.length === 0 ? (
        <SectionSkeleton />
      ) : (
        trendingGames.length > 0 && (
          <SectionRow
            title="Trending Now"
            onViewAll={() => handleViewAll('sort=trending')}
          >
            <GameCardRow
              games={trendingGames}
              onPlay={handlePlay}
              onFavourite={favouriteGame}
              onUnfavourite={unfavouriteGame}
            />
          </SectionRow>
        )
      )}

      {/* Ad: leaderboard between sections */}
      <div className="flex justify-center">
        <AdSlot format="leaderboard" className="hidden sm:block" />
        <AdSlot format="mobile-banner" className="sm:hidden" />
      </div>

      {/* Just Created */}
      {isInitialLoad ? (
        <SectionSkeleton />
      ) : (
        justCreated.length > 0 && (
          <SectionRow
            title="Just Created"
            onViewAll={() => handleViewAll('sort=newest')}
          >
            <GameCardRow
              games={justCreated}
              onPlay={handlePlay}
              onFavourite={favouriteGame}
              onUnfavourite={unfavouriteGame}
            />
          </SectionRow>
        )
      )}

      {/* 3D Games */}
      {threeD.length > 0 && (
        <SectionRow
          title="3D Games"
          onViewAll={() => handleViewAll('engine=threejs')}
        >
          <GameCardRow
            games={threeD}
            onPlay={handlePlay}
            onFavourite={favouriteGame}
            onUnfavourite={unfavouriteGame}
          />
        </SectionRow>
      )}

      {/* Play With Friends */}
      {multiplayer.length > 0 && (
        <SectionRow
          title="Play With Friends"
          onViewAll={() => handleViewAll('multiplayer=true')}
        >
          <GameCardRow
            games={multiplayer}
            onPlay={handlePlay}
            onFavourite={favouriteGame}
            onUnfavourite={unfavouriteGame}
          />
        </SectionRow>
      )}

      {/* Ad: medium rectangle at bottom */}
      <div className="flex justify-center">
        <AdSlot format="rectangle" />
      </div>

      {/* Empty state when nothing available */}
      {!isInitialLoad && feedGames.length === 0 && trendingGames.length === 0 && (
        <motion.div
          className="flex flex-col items-center justify-center gap-4 py-20"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        >
          <Gamepad2 size={56} className="text-sloppy-text-muted" />
          <h2 className="font-heading text-2xl text-sloppy-text text-center">
            No games yet!
          </h2>
          <p className="text-sloppy-text-muted text-center max-w-sm">
            Go create something sloppy — be the first to launch a game.
          </p>
          <SloppyButton onClick={() => navigate('/create')}>Create a Game</SloppyButton>
        </motion.div>
      )}
    </motion.div>
  );
}
