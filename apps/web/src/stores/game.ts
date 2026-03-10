import { create } from 'zustand';
import {
  gamesApi,
  favouritesApi,
  tikTokFeedApi,
  type GameFeedItem,
  type FeedSort,
  type FavouritesSort,
} from '../lib/api';
import { toast } from '../components/ui/SloppyToast';

export interface SearchFilters {
  genre?: string | null;
  engine?: string | null;
  multiplayer?: boolean;
  sort?: string;
}

interface GameState {
  feedGames: GameFeedItem[];
  feedCursor: string | null;
  feedSort: FeedSort;
  hasMore: boolean;
  isLoadingFeed: boolean;
  feedError: string | null;

  favouriteGames: GameFeedItem[];
  favouritesCursor: string | null;
  favouritesSort: FavouritesSort;
  hasMoreFavourites: boolean;
  isLoadingFavourites: boolean;
  favouritesError: string | null;

  myGames: GameFeedItem[];
  currentGame: GameFeedItem | null;

  // Search & discovery
  searchResults: GameFeedItem[];
  searchCursor: string | null;
  searchQuery: string;
  searchFilters: SearchFilters;
  hasMoreSearch: boolean;
  isLoadingSearch: boolean;
  searchError: string | null;

  trendingGames: GameFeedItem[];
  isLoadingTrending: boolean;

  featuredGames: GameFeedItem[];
  isLoadingFeatured: boolean;

  categoryGames: GameFeedItem[];
  categoryCursor: string | null;
  hasMoreCategory: boolean;
  isLoadingCategory: boolean;

  // TikTok-style feed
  tikTokGames: GameFeedItem[];
  tikTokCursor: string | null;
  hasMoreTikTok: boolean;
  isLoadingTikTok: boolean;
  tikTokError: string | null;

  fetchFeed: (reset?: boolean) => Promise<void>;
  setFeedSort: (sort: FeedSort) => void;
  fetchFavourites: (reset?: boolean) => Promise<void>;
  setFavouritesSort: (sort: FavouritesSort) => void;
  fetchMyGames: () => Promise<void>;
  setCurrentGame: (game: GameFeedItem | null) => void;
  favouriteGame: (gameId: string) => Promise<void>;
  unfavouriteGame: (gameId: string) => Promise<void>;
  unfavouriteGameWithUndo: (gameId: string) => void;
  incrementPlayCount: (gameId: string) => void;

  search: (query: string, filters?: SearchFilters, reset?: boolean) => Promise<void>;
  clearSearch: () => void;
  setSearchFilters: (filters: SearchFilters) => void;
  fetchTrending: () => Promise<void>;
  fetchFeatured: () => Promise<void>;
  fetchByGenre: (genre: string, reset?: boolean, sort?: string) => Promise<void>;
  fetchTikTokFeed: (reset?: boolean) => Promise<void>;
  deleteGame: (gameId: string) => Promise<boolean>;
}

export const useGameStore = create<GameState>()((set, get) => ({
  feedGames: [],
  feedCursor: null,
  feedSort: 'recent',
  hasMore: true,
  isLoadingFeed: false,
  feedError: null,

  favouriteGames: [],
  favouritesCursor: null,
  favouritesSort: 'recent',
  hasMoreFavourites: true,
  isLoadingFavourites: false,
  favouritesError: null,

  myGames: [],
  currentGame: null,

  searchResults: [],
  searchCursor: null,
  searchQuery: '',
  searchFilters: {},
  hasMoreSearch: true,
  isLoadingSearch: false,
  searchError: null,

  trendingGames: [],
  isLoadingTrending: false,

  featuredGames: [],
  isLoadingFeatured: false,

  categoryGames: [],
  categoryCursor: null,
  hasMoreCategory: true,
  isLoadingCategory: false,

  tikTokGames: [],
  tikTokCursor: null,
  hasMoreTikTok: true,
  isLoadingTikTok: false,
  tikTokError: null,

  fetchFeed: async (reset = false) => {
    const { isLoadingFeed, feedCursor, feedSort, hasMore } = get();
    if (isLoadingFeed) return;
    if (!reset && !hasMore) return;

    const cursor = reset ? undefined : feedCursor ?? undefined;
    set({ isLoadingFeed: true, feedError: null });

    try {
      const res = await gamesApi.feed({ cursor, limit: 20, sort: feedSort });
      set((s) => ({
        feedGames: reset ? res.data : [...s.feedGames, ...res.data],
        feedCursor: res.nextCursor,
        hasMore: res.hasMore,
      }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load games';
      set({ feedError: msg });
    } finally {
      set({ isLoadingFeed: false });
    }
  },

  setFeedSort: (sort) => {
    set({ feedSort: sort, feedGames: [], feedCursor: null, hasMore: true, feedError: null });
  },

  fetchFavourites: async (reset = false) => {
    const { isLoadingFavourites, favouritesCursor, favouritesSort, hasMoreFavourites } = get();
    if (isLoadingFavourites) return;
    if (!reset && !hasMoreFavourites) return;

    const cursor = reset ? undefined : favouritesCursor ?? undefined;
    set({ isLoadingFavourites: true, favouritesError: null });

    try {
      const res = await favouritesApi.list({ cursor, limit: 20, sort: favouritesSort });
      set((s) => ({
        favouriteGames: reset ? res.data : [...s.favouriteGames, ...res.data],
        favouritesCursor: res.nextCursor,
        hasMoreFavourites: res.hasMore,
      }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load favourites';
      set({ favouritesError: msg });
    } finally {
      set({ isLoadingFavourites: false });
    }
  },

  setFavouritesSort: (sort) => {
    set({
      favouritesSort: sort,
      favouriteGames: [],
      favouritesCursor: null,
      hasMoreFavourites: true,
      favouritesError: null,
    });
  },

  fetchMyGames: async () => {
    try {
      const res = await gamesApi.mine({ limit: 100 });
      set({ myGames: res.data });
    } catch {
      /* noop */
    }
  },

  setCurrentGame: (game) => set({ currentGame: game }),

  favouriteGame: async (gameId) => {
    const fav = (g: GameFeedItem) =>
      g.id === gameId ? { ...g, isFavourited: true, favouriteCount: (g.favouriteCount ?? 0) + 1 } : g;
    const unfav = (g: GameFeedItem) =>
      g.id === gameId ? { ...g, isFavourited: false, favouriteCount: Math.max(0, (g.favouriteCount ?? 1) - 1) } : g;

    set((s) => ({
      feedGames: s.feedGames.map(fav),
      favouriteGames: s.favouriteGames.map(fav),
      tikTokGames: s.tikTokGames.map(fav),
      trendingGames: s.trendingGames.map(fav),
      searchResults: s.searchResults.map(fav),
      categoryGames: s.categoryGames.map(fav),
      currentGame: s.currentGame?.id === gameId ? fav(s.currentGame) : s.currentGame,
    }));
    try {
      await favouritesApi.add(gameId);
    } catch {
      set((s) => ({
        feedGames: s.feedGames.map(unfav),
        favouriteGames: s.favouriteGames.map(unfav),
        tikTokGames: s.tikTokGames.map(unfav),
        trendingGames: s.trendingGames.map(unfav),
        searchResults: s.searchResults.map(unfav),
        categoryGames: s.categoryGames.map(unfav),
        currentGame: s.currentGame?.id === gameId ? unfav(s.currentGame) : s.currentGame,
      }));
      toast('Failed to update favourite', 'error');
    }
  },

  unfavouriteGame: async (gameId) => {
    const unfav = (g: GameFeedItem) =>
      g.id === gameId ? { ...g, isFavourited: false, favouriteCount: Math.max(0, (g.favouriteCount ?? 1) - 1) } : g;
    const refav = (g: GameFeedItem) =>
      g.id === gameId ? { ...g, isFavourited: true, favouriteCount: (g.favouriteCount ?? 0) + 1 } : g;

    set((s) => ({
      feedGames: s.feedGames.map(unfav),
      favouriteGames: s.favouriteGames.map(unfav),
      tikTokGames: s.tikTokGames.map(unfav),
      trendingGames: s.trendingGames.map(unfav),
      searchResults: s.searchResults.map(unfav),
      categoryGames: s.categoryGames.map(unfav),
      currentGame: s.currentGame?.id === gameId ? unfav(s.currentGame) : s.currentGame,
    }));
    try {
      await favouritesApi.remove(gameId);
    } catch {
      set((s) => ({
        feedGames: s.feedGames.map(refav),
        favouriteGames: s.favouriteGames.map(refav),
        tikTokGames: s.tikTokGames.map(refav),
        trendingGames: s.trendingGames.map(refav),
        searchResults: s.searchResults.map(refav),
        categoryGames: s.categoryGames.map(refav),
        currentGame: s.currentGame?.id === gameId ? refav(s.currentGame) : s.currentGame,
      }));
      toast('Failed to update favourite', 'error');
    }
  },

  unfavouriteGameWithUndo: (gameId) => {
    const { favouriteGames } = get();
    const removedGame = favouriteGames.find((g) => g.id === gameId);
    const removedIndex = favouriteGames.findIndex((g) => g.id === gameId);

    const markUnfav = (g: GameFeedItem) =>
      g.id === gameId ? { ...g, isFavourited: false } : g;
    const markFav = (g: GameFeedItem) =>
      g.id === gameId ? { ...g, isFavourited: true } : g;

    set((s) => ({
      feedGames: s.feedGames.map(markUnfav),
      favouriteGames: s.favouriteGames.filter((g) => g.id !== gameId),
      tikTokGames: s.tikTokGames.map(markUnfav),
      trendingGames: s.trendingGames.map(markUnfav),
      searchResults: s.searchResults.map(markUnfav),
      categoryGames: s.categoryGames.map(markUnfav),
      currentGame:
        s.currentGame?.id === gameId
          ? { ...s.currentGame, isFavourited: false }
          : s.currentGame,
    }));

    let undone = false;
    const undo = () => {
      undone = true;
      if (removedGame) {
        const restored = { ...removedGame, isFavourited: true };
        set((s) => {
          const games = [...s.favouriteGames];
          games.splice(Math.min(removedIndex, games.length), 0, restored);
          return {
            feedGames: s.feedGames.map(markFav),
            favouriteGames: games,
            tikTokGames: s.tikTokGames.map(markFav),
            trendingGames: s.trendingGames.map(markFav),
            searchResults: s.searchResults.map(markFav),
            categoryGames: s.categoryGames.map(markFav),
            currentGame:
              s.currentGame?.id === gameId
                ? { ...s.currentGame, isFavourited: true }
                : s.currentGame,
          };
        });
      }
      favouritesApi.add(gameId).catch(() => {
        toast('Failed to re-favourite', 'error');
      });
    };

    toast('Removed from favourites', {
      type: 'info',
      action: { label: 'Undo', onClick: undo },
      duration: 5000,
    });

    favouritesApi.remove(gameId).catch(() => {
      if (!undone) {
        if (removedGame) {
          set((s) => {
            const games = [...s.favouriteGames];
            games.splice(Math.min(removedIndex, games.length), 0, {
              ...removedGame,
              isFavourited: true,
            });
            return {
              feedGames: s.feedGames.map(markFav),
              favouriteGames: games,
              tikTokGames: s.tikTokGames.map(markFav),
              trendingGames: s.trendingGames.map(markFav),
              searchResults: s.searchResults.map(markFav),
              categoryGames: s.categoryGames.map(markFav),
              currentGame:
                s.currentGame?.id === gameId
                  ? { ...s.currentGame, isFavourited: true }
                  : s.currentGame,
            };
          });
        }
        toast('Failed to update favourite', 'error');
      }
    });
  },

  incrementPlayCount: (gameId) => {
    set((s) => ({
      feedGames: s.feedGames.map((g) =>
        g.id === gameId ? { ...g, playCount: g.playCount + 1 } : g,
      ),
      currentGame:
        s.currentGame?.id === gameId
          ? { ...s.currentGame, playCount: s.currentGame.playCount + 1 }
          : s.currentGame,
    }));
  },

  search: async (query, filters, reset = true) => {
    const { isLoadingSearch, searchCursor, hasMoreSearch, searchFilters } = get();
    if (isLoadingSearch) return;
    if (!reset && !hasMoreSearch) return;

    const mergedFilters = filters ?? searchFilters;
    const cursor = reset ? undefined : searchCursor ?? undefined;
    set({ isLoadingSearch: true, searchError: null, searchQuery: query, searchFilters: mergedFilters });

    try {
      const res = await gamesApi.search({
        query: query || undefined,
        genre: mergedFilters.genre ?? undefined,
        engine: mergedFilters.engine ?? undefined,
        multiplayer: mergedFilters.multiplayer,
        sort: mergedFilters.sort,
        cursor,
        limit: 20,
      });
      set((s) => ({
        searchResults: reset ? res.data : [...s.searchResults, ...res.data],
        searchCursor: res.nextCursor,
        hasMoreSearch: res.hasMore,
      }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Search failed';
      set({ searchError: msg });
    } finally {
      set({ isLoadingSearch: false });
    }
  },

  clearSearch: () => {
    set({
      searchResults: [],
      searchCursor: null,
      searchQuery: '',
      searchFilters: {},
      hasMoreSearch: true,
      searchError: null,
    });
  },

  setSearchFilters: (filters) => {
    set({ searchFilters: filters });
  },

  fetchTrending: async () => {
    const { isLoadingTrending } = get();
    if (isLoadingTrending) return;
    set({ isLoadingTrending: true });
    try {
      const res = await gamesApi.getTrending({ hours: 24, limit: 10 });
      set({ trendingGames: res.data });
    } catch {
      /* non-critical */
    } finally {
      set({ isLoadingTrending: false });
    }
  },

  fetchFeatured: async () => {
    const { isLoadingFeatured } = get();
    if (isLoadingFeatured) return;
    set({ isLoadingFeatured: true });
    try {
      const res = await gamesApi.getFeatured(5);
      set({ featuredGames: res.data });
    } catch {
      /* non-critical */
    } finally {
      set({ isLoadingFeatured: false });
    }
  },

  fetchByGenre: async (genre, reset = true, sort) => {
    const { isLoadingCategory, categoryCursor, hasMoreCategory } = get();
    if (isLoadingCategory) return;
    if (!reset && !hasMoreCategory) return;

    const cursor = reset ? undefined : categoryCursor ?? undefined;
    set({ isLoadingCategory: true });

    try {
      const res = await gamesApi.getByGenre(genre, { cursor, limit: 20, sort });
      set((s) => ({
        categoryGames: reset ? res.data : [...s.categoryGames, ...res.data],
        categoryCursor: res.nextCursor,
        hasMoreCategory: res.hasMore,
      }));
    } catch {
      /* non-critical */
    } finally {
      set({ isLoadingCategory: false });
    }
  },

  fetchTikTokFeed: async (reset = false) => {
    const { isLoadingTikTok, tikTokCursor, hasMoreTikTok } = get();
    if (isLoadingTikTok) return;
    if (!reset && !hasMoreTikTok) return;

    const cursor = reset ? undefined : tikTokCursor ?? undefined;
    set({ isLoadingTikTok: true, tikTokError: null });

    try {
      const res = await tikTokFeedApi.algorithm({ cursor, limit: 10 });
      set((s) => ({
        tikTokGames: reset ? res.data : [...s.tikTokGames, ...res.data],
        tikTokCursor: res.nextCursor,
        hasMoreTikTok: res.hasMore,
      }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load feed';
      set({ tikTokError: msg });
    } finally {
      set({ isLoadingTikTok: false });
    }
  },

  deleteGame: async (gameId) => {
    try {
      await gamesApi.delete(gameId);
      set((s) => ({
        myGames: s.myGames.filter((g) => g.id !== gameId),
      }));
      toast('Draft deleted', 'primary');
      return true;
    } catch {
      toast('Failed to delete game', 'error');
      return false;
    }
  },
}));
