import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { GameFeedItem } from '../lib/api';

interface UIState {
  isMusicPlaying: boolean;
  isLobbyMusicActive: boolean;
  isGameAudioActive: boolean;
  isGameOverlayOpen: boolean;
  gameOverlayId: string | null;
  gameOverlayData: GameFeedItem | null;
  hasSeenIntro: boolean;
  hasSeenSoundIcon: boolean;

  toggleMusic: () => void;
  setLobbyMusicActive: (active: boolean) => void;
  setGameAudioActive: (active: boolean) => void;
  openGameOverlay: (gameId: string, game?: GameFeedItem) => void;
  closeGameOverlay: () => void;
  markIntroSeen: () => void;
  markSoundIconSeen: () => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      isMusicPlaying: false,
      isLobbyMusicActive: false,
      isGameAudioActive: false,
      isGameOverlayOpen: false,
      gameOverlayId: null,
      gameOverlayData: null,
      hasSeenIntro: false,
      hasSeenSoundIcon: false,

      toggleMusic: () => set((s) => ({ isMusicPlaying: !s.isMusicPlaying })),
      setLobbyMusicActive: (active) => set({ isLobbyMusicActive: active }),
      setGameAudioActive: (active) => set({ isGameAudioActive: active }),
      openGameOverlay: (gameId, game) =>
        set({ isGameOverlayOpen: true, gameOverlayId: gameId, gameOverlayData: game ?? null }),
      closeGameOverlay: () =>
        set({ isGameOverlayOpen: false, gameOverlayId: null, gameOverlayData: null, isGameAudioActive: false }),
      markIntroSeen: () => set({ hasSeenIntro: true }),
      markSoundIconSeen: () => set({ hasSeenSoundIcon: true }),
    }),
    {
      name: 'sloppy-ui',
      partialize: (state) => ({
        isMusicPlaying: state.isMusicPlaying,
        hasSeenIntro: state.hasSeenIntro,
        hasSeenSoundIcon: state.hasSeenSoundIcon,
      }),
    },
  ),
);
