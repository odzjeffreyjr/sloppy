import { create } from 'zustand';
import {
  gamesApi,
  favouritesApi,
  type GameFeedItem,
  type FeedSort,
  type FavouritesSort,
} from '../lib/api';
import { toast } from '../components/ui/SloppyToast';

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
    set((s) => ({
      feedGames: s.feedGames.map((g) =>
        g.id === gameId ? { ...g, isFavourited: true } : g,
      ),
      favouriteGames: s.favouriteGames.map((g) =>
        g.id === gameId ? { ...g, isFavourited: true } : g,
      ),
      currentGame:
        s.currentGame?.id === gameId
          ? { ...s.currentGame, isFavourited: true }
          : s.currentGame,
    }));
    try {
      await favouritesApi.add(gameId);
    } catch {
      set((s) => ({
        feedGames: s.feedGames.map((g) =>
          g.id === gameId ? { ...g, isFavourited: false } : g,
        ),
        favouriteGames: s.favouriteGames.map((g) =>
          g.id === gameId ? { ...g, isFavourited: false } : g,
        ),
        currentGame:
          s.currentGame?.id === gameId
            ? { ...s.currentGame, isFavourited: false }
            : s.currentGame,
      }));
      toast('Failed to update favourite', 'error');
    }
  },

  unfavouriteGame: async (gameId) => {
    set((s) => ({
      feedGames: s.feedGames.map((g) =>
        g.id === gameId ? { ...g, isFavourited: false } : g,
      ),
      favouriteGames: s.favouriteGames.map((g) =>
        g.id === gameId ? { ...g, isFavourited: false } : g,
      ),
      currentGame:
        s.currentGame?.id === gameId
          ? { ...s.currentGame, isFavourited: false }
          : s.currentGame,
    }));
    try {
      await favouritesApi.remove(gameId);
    } catch {
      set((s) => ({
        feedGames: s.feedGames.map((g) =>
          g.id === gameId ? { ...g, isFavourited: true } : g,
        ),
        favouriteGames: s.favouriteGames.map((g) =>
          g.id === gameId ? { ...g, isFavourited: true } : g,
        ),
        currentGame:
          s.currentGame?.id === gameId
            ? { ...s.currentGame, isFavourited: true }
            : s.currentGame,
      }));
      toast('Failed to update favourite', 'error');
    }
  },

  unfavouriteGameWithUndo: (gameId) => {
    const { favouriteGames } = get();
    const removedGame = favouriteGames.find((g) => g.id === gameId);
    const removedIndex = favouriteGames.findIndex((g) => g.id === gameId);

    set((s) => ({
      feedGames: s.feedGames.map((g) =>
        g.id === gameId ? { ...g, isFavourited: false } : g,
      ),
      favouriteGames: s.favouriteGames.filter((g) => g.id !== gameId),
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
            feedGames: s.feedGames.map((g) =>
              g.id === gameId ? { ...g, isFavourited: true } : g,
            ),
            favouriteGames: games,
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
              feedGames: s.feedGames.map((g) =>
                g.id === gameId ? { ...g, isFavourited: true } : g,
              ),
              favouriteGames: games,
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
}));
