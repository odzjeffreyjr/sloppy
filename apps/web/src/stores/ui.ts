import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { GameFeedItem } from '../lib/api';

interface UIState {
  isMusicPlaying: boolean;
  isLobbyMusicActive: boolean;
  isGameOverlayOpen: boolean;
  gameOverlayId: string | null;
  gameOverlayData: GameFeedItem | null;
  hasSeenIntro: boolean;

  toggleMusic: () => void;
  setLobbyMusicActive: (active: boolean) => void;
  openGameOverlay: (gameId: string, game?: GameFeedItem) => void;
  closeGameOverlay: () => void;
  markIntroSeen: () => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      isMusicPlaying: false,
      isLobbyMusicActive: false,
      isGameOverlayOpen: false,
      gameOverlayId: null,
      gameOverlayData: null,
      hasSeenIntro: false,

      toggleMusic: () => set((s) => ({ isMusicPlaying: !s.isMusicPlaying })),
      setLobbyMusicActive: (active) => set({ isLobbyMusicActive: active }),
      openGameOverlay: (gameId, game) =>
        set({ isGameOverlayOpen: true, gameOverlayId: gameId, gameOverlayData: game ?? null }),
      closeGameOverlay: () =>
        set({ isGameOverlayOpen: false, gameOverlayId: null, gameOverlayData: null }),
      markIntroSeen: () => set({ hasSeenIntro: true }),
    }),
    {
      name: 'sloppy-ui',
      partialize: (state) => ({
        isMusicPlaying: state.isMusicPlaying,
        hasSeenIntro: state.hasSeenIntro,
      }),
    },
  ),
);
