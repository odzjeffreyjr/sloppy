import { motion } from 'framer-motion';
import { useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, SearchX } from 'lucide-react';
import { useGameStore, type SearchFilters } from '../stores/game';
import { useUIStore } from '../stores/ui';
import { SearchBar } from '../components/ui/SearchBar';
import { FilterBar } from '../components/ui/FilterBar';
import { GameCard } from '../components/ui/GameCard';
import { GameCardSkeletonGrid } from '../components/ui/GameCardSkeleton';
import { SloppySpinner } from '../components/ui/SloppySpinner';
import { AdSlot } from '../components/ui/AdSlot';
import { SloppyButton } from '../components/ui/SloppyButton';
import type { GameFeedItem } from '../lib/api';

export default function Explore() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { openGameOverlay } = useUIStore();
  const {
    searchResults,
    searchQuery,
    searchFilters,
    hasMoreSearch,
    isLoadingSearch,
    searchError,
    search,
    setSearchFilters,
    favouriteGame,
    unfavouriteGame,
  } = useGameStore();

  const initializedRef = useRef(false);

  // Sync URL params to state on mount
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const q = searchParams.get('q') || '';
    const genre = searchParams.get('genre') || null;
    const engine = searchParams.get('engine') || null;
    const multiplayer = searchParams.get('multiplayer') === 'true';
    const sort = searchParams.get('sort') || 'popular';

    const filters: SearchFilters = { genre, engine, multiplayer, sort };
    setSearchFilters(filters);
    search(q, filters, true);
  }, [searchParams, search, setSearchFilters]);

  const updateUrl = useCallback(
    (query: string, filters: SearchFilters) => {
      const params = new URLSearchParams();
      if (query) params.set('q', query);
      if (filters.genre) params.set('genre', filters.genre);
      if (filters.engine) params.set('engine', filters.engine);
      if (filters.multiplayer) params.set('multiplayer', 'true');
      if (filters.sort && filters.sort !== 'popular') params.set('sort', filters.sort);
      setSearchParams(params, { replace: true });
    },
    [setSearchParams],
  );

  const handleSearch = useCallback(
    (query: string) => {
      const filters = useGameStore.getState().searchFilters;
      updateUrl(query, filters);
      search(query, filters, true);
    },
    [search, updateUrl],
  );

  const handleGenreChange = useCallback(
    (genre: string | null) => {
      const currentQuery = useGameStore.getState().searchQuery;
      const newFilters = { ...useGameStore.getState().searchFilters, genre };
      setSearchFilters(newFilters);
      updateUrl(currentQuery, newFilters);
      search(currentQuery, newFilters, true);
    },
    [search, setSearchFilters, updateUrl],
  );

  const handleEngineChange = useCallback(
    (engine: string | null) => {
      const currentQuery = useGameStore.getState().searchQuery;
      const newFilters = { ...useGameStore.getState().searchFilters, engine };
      setSearchFilters(newFilters);
      updateUrl(currentQuery, newFilters);
      search(currentQuery, newFilters, true);
    },
    [search, setSearchFilters, updateUrl],
  );

  const handleMultiplayerChange = useCallback(
    (multiplayer: boolean) => {
      const currentQuery = useGameStore.getState().searchQuery;
      const newFilters = { ...useGameStore.getState().searchFilters, multiplayer };
      setSearchFilters(newFilters);
      updateUrl(currentQuery, newFilters);
      search(currentQuery, newFilters, true);
    },
    [search, setSearchFilters, updateUrl],
  );

  const handleSortChange = useCallback(
    (sort: string) => {
      const currentQuery = useGameStore.getState().searchQuery;
      const newFilters = { ...useGameStore.getState().searchFilters, sort };
      setSearchFilters(newFilters);
      updateUrl(currentQuery, newFilters);
      search(currentQuery, newFilters, true);
    },
    [search, setSearchFilters, updateUrl],
  );

  const handlePlay = useCallback(
    (game: GameFeedItem) => {
      openGameOverlay(game.id, game, true);
      navigate(`/game/${game.id}`);
    },
    [openGameOverlay, navigate],
  );

  const loadMore = useCallback(() => {
    if (!isLoadingSearch && hasMoreSearch) {
      search(searchQuery, searchFilters, false);
    }
  }, [isLoadingSearch, hasMoreSearch, search, searchQuery, searchFilters]);

  // Infinite scroll
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

  const isInitialLoad = isLoadingSearch && searchResults.length === 0;
  const showEmpty = !isLoadingSearch && searchResults.length === 0 && !searchError;

  return (
    <motion.div
      className="space-y-5 pb-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div>
        <h1 className="font-heading text-2xl text-sloppy-text mb-4">Explore Games</h1>
        <SearchBar onSearch={handleSearch} className="mb-4" />
        <FilterBar
          selectedGenre={searchFilters.genre ?? null}
          selectedEngine={searchFilters.engine ?? null}
          multiplayerOnly={searchFilters.multiplayer ?? false}
          sortBy={searchFilters.sort ?? 'popular'}
          onGenreChange={handleGenreChange}
          onEngineChange={handleEngineChange}
          onMultiplayerChange={handleMultiplayerChange}
          onSortChange={handleSortChange}
        />
      </div>

      {/* Loading */}
      {isInitialLoad && <GameCardSkeletonGrid count={8} />}

      {/* Error */}
      {searchError && (
        <motion.div
          className="flex flex-col items-center justify-center gap-4 py-16"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <AlertTriangle size={48} className="text-sloppy-text-muted" />
          <p className="text-sloppy-text-muted text-center">{searchError}</p>
          <SloppyButton onClick={() => search(searchQuery, searchFilters, true)}>Try Again</SloppyButton>
        </motion.div>
      )}

      {/* Results grid with inline ads every 8 cards */}
      {searchResults.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {searchResults.map((game, i) => (
            <AdCardFragment key={game.id} index={i}>
              <GameCard
                game={game}
                onPlay={handlePlay}
                onFavourite={favouriteGame}
                onUnfavourite={unfavouriteGame}
              />
            </AdCardFragment>
          ))}
        </div>
      )}

      {/* Infinite scroll sentinel */}
      {hasMoreSearch && searchResults.length > 0 && (
        <div ref={sentinelRef} className="flex justify-center py-6">
          {isLoadingSearch && <SloppySpinner size={32} />}
        </div>
      )}

      {/* No more results */}
      {!hasMoreSearch && searchResults.length > 0 && (
        <p className="text-center text-sloppy-text-muted/50 font-heading text-sm py-4">
          That's everything!
        </p>
      )}

      {/* Empty state */}
      {showEmpty && (
        <motion.div
          className="flex flex-col items-center justify-center gap-4 py-16"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        >
          <SearchX size={48} className="text-sloppy-text-muted" />
          <h2 className="font-heading text-xl text-sloppy-text text-center">
            No games found
          </h2>
          <p className="text-sloppy-text-muted text-center max-w-sm text-sm">
            {searchQuery
              ? `No results for "${searchQuery}". Why not create it?`
              : 'Try adjusting your filters.'}
          </p>
          {searchQuery && (
            <SloppyButton onClick={() => navigate(`/create?prompt=${encodeURIComponent(searchQuery)}`)}>
              Create "{searchQuery}"
            </SloppyButton>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}

const AD_INTERVAL = 8;

function AdCardFragment({ index, children }: { index: number; children: React.ReactNode }) {
  const showAd = index > 0 && index % AD_INTERVAL === 0;
  return (
    <>
      {showAd && (
        <div className="col-span-2 sm:col-span-3 lg:col-span-4 flex justify-center py-2">
          <AdSlot format="rectangle" />
        </div>
      )}
      {children}
    </>
  );
}
