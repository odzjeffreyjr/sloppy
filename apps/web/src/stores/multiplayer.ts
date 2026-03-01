import { create } from 'zustand';
import { MultiplayerClient, type ConnectionState } from '@sloppy/multiplayer-sdk';
import { sessionsApi, type MultiplayerSessionData } from '../lib/api';
import { useAuthStore } from './auth';

const PLAYER_COLORS = [
  '#FF6B9D', '#00D4AA', '#B8FF57', '#FFD93D',
  '#FF8C42', '#A855F7', '#06B6D4', '#F97316',
];
const PLAYER_AVATARS = ['🦊', '🐸', '🐙', '🦄', '🐲', '🎃', '🤖', '🎮'];

export interface PlayerInfo {
  id: string;
  displayName?: string;
  color: string;
  avatar: string;
  isHost: boolean;
}

export type DisconnectReason = 'left' | 'host_left' | 'connection_lost' | null;

export { type ConnectionState } from '@sloppy/multiplayer-sdk';

// ── Helpers ──────────────────────────────────────────────────────────

function getPlayerId(): string {
  return useAuthStore.getState().user?.id ?? `anon-${Math.random().toString(36).slice(2, 10)}`;
}

function getDisplayName(): string {
  return useAuthStore.getState().user?.displayName ?? 'Player';
}

function assignVisuals(
  playerId: string,
  index: number,
): Pick<PlayerInfo, 'color' | 'avatar'> {
  const hash = playerId.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return {
    color: PLAYER_COLORS[index % PLAYER_COLORS.length],
    avatar: PLAYER_AVATARS[hash % PLAYER_AVATARS.length],
  };
}

export function formatSessionCode(sessionId: string): string {
  return `SLOP-${sessionId.replace(/-/g, '').substring(0, 4).toUpperCase()}`;
}

export function parseSessionInput(input: string): string {
  const trimmed = input.trim();
  try {
    const url = new URL(trimmed);
    const sessionParam = url.searchParams.get('session');
    if (sessionParam) return sessionParam;
  } catch {
    /* not a URL — treat as raw session ID */
  }
  return trimmed;
}

// Module-level ref for the iframe window used by the postMessage bridge.
// Stored outside the store to avoid putting DOM objects in state.
let _iframeWindow: Window | null = null;

export function setMultiplayerIframeWindow(win: Window | null) {
  _iframeWindow = win;
}

function postToIframe(message: Record<string, unknown>) {
  _iframeWindow?.postMessage(message, '*');
}

const WS_URL =
  import.meta.env.VITE_MULTIPLAYER_WS_URL ??
  `${(import.meta.env.VITE_API_URL ?? 'http://localhost:3001').replace(/^http/, 'ws')}/multiplayer/ws`;

// ── Store ────────────────────────────────────────────────────────────

interface MultiplayerState {
  session: MultiplayerSessionData | null;
  connectionState: ConnectionState;
  players: PlayerInfo[];
  ping: number;
  isHost: boolean;
  isGameActive: boolean;
  isModalOpen: boolean;
  error: string | null;
  disconnectReason: DisconnectReason;
  client: MultiplayerClient | null;

  openModal: () => void;
  closeModal: () => void;
  createSession: (gameId: string, maxPlayers?: number) => Promise<void>;
  joinSession: (input: string) => Promise<void>;
  startGame: () => void;
  connect: (sessionId: string) => void;
  disconnect: () => void;
  leaveSession: () => void;
  sendInput: (input: unknown) => void;
  clearError: () => void;
  reset: () => void;
}

export const useMultiplayerStore = create<MultiplayerState>()((set, get) => {
  // Internal flags used to distinguish intentional vs forced disconnects.
  let _isLeaving = false;
  let _prevConnectionState: ConnectionState = 'disconnected';

  // Ping measurement: send a timestamped input periodically and measure until
  // the next state update arrives.
  let _pingStart = 0;
  let _pingInterval: ReturnType<typeof setInterval> | null = null;

  function startPingLoop() {
    stopPingLoop();
    _pingInterval = setInterval(() => {
      if (get().connectionState === 'connected') {
        _pingStart = performance.now();
        get().client?.sendInput({ __ping: true });
      }
    }, 5000);
  }

  function stopPingLoop() {
    if (_pingInterval) {
      clearInterval(_pingInterval);
      _pingInterval = null;
    }
    _pingStart = 0;
  }

  return {
    session: null,
    connectionState: 'disconnected',
    players: [],
    ping: 0,
    isHost: false,
    isGameActive: false,
    isModalOpen: false,
    error: null,
    disconnectReason: null,
    client: null,

    openModal: () => set({ isModalOpen: true, error: null }),

    closeModal: () => set({ isModalOpen: false }),

    createSession: async (gameId, maxPlayers) => {
      set({ error: null });
      try {
        const res = await sessionsApi.create(gameId, maxPlayers);
        const playerId = getPlayerId();
        set({
          session: res.data,
          isHost: true,
          players: [
            {
              id: playerId,
              displayName: getDisplayName(),
              ...assignVisuals(playerId, 0),
              isHost: true,
            },
          ],
        });
        get().connect(res.data.id);
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message : 'Failed to create session';
        set({ error: msg });
      }
    },

    joinSession: async (input) => {
      set({ error: null });
      const sessionId = parseSessionInput(input);
      if (!sessionId) {
        set({ error: 'Please enter a session code' });
        return;
      }
      try {
        const res = await sessionsApi.join(sessionId);
        const playerId = getPlayerId();
        set({
          session: res.data,
          isHost: res.data.hostId === playerId,
          players: [
            {
              id: playerId,
              displayName: getDisplayName(),
              ...assignVisuals(playerId, 0),
              isHost: res.data.hostId === playerId,
            },
          ],
        });
        get().connect(res.data.id);
      } catch (err: unknown) {
        const apiErr = err as { statusCode?: number; message?: string };
        const message =
          apiErr.statusCode === 404
            ? 'Session not found'
            : apiErr.statusCode === 409
              ? 'Session is full'
              : apiErr.message ?? 'Failed to join session';
        set({ error: message });
      }
    },

    startGame: () => {
      const { client, isHost, session, players } = get();
      if (!isHost || !client || !session) return;
      client.sendInput({ action: 'start_game' });
      set({ isGameActive: true, isModalOpen: false });
      postToIframe({
        type: 'sloppy:multiplayer:start',
        sessionId: session.id,
        playerId: getPlayerId(),
        players: players.map((p) => ({ id: p.id, displayName: p.displayName })),
      });
    },

    connect: (sessionId) => {
      const existing = get().client;
      if (existing) existing.disconnect();

      const playerId = getPlayerId();
      const client = new MultiplayerClient({
        serverUrl: WS_URL,
        maxReconnectAttempts: 3,
      });

      client.onConnectionChange((state) => {
        if (state === 'connected') {
          startPingLoop();
        } else if (state === 'disconnected') {
          stopPingLoop();
        }

        // Detect unexpected disconnects to determine the cause.
        if (state === 'disconnected' && !_isLeaving && get().session) {
          if (_prevConnectionState === 'reconnecting') {
            set({ disconnectReason: 'connection_lost' });
          } else if (_prevConnectionState === 'connected') {
            set({ disconnectReason: 'host_left' });
          }
        }
        _prevConnectionState = state;
        set({ connectionState: state });
      });

      client.onPlayerJoin((joinedPlayerId) => {
        set((s) => {
          if (s.players.some((p) => p.id === joinedPlayerId)) return s;
          return {
            players: [
              ...s.players,
              {
                id: joinedPlayerId,
                ...assignVisuals(joinedPlayerId, s.players.length),
                isHost: false,
              },
            ],
          };
        });
        postToIframe({
          type: 'sloppy:multiplayer:player_join',
          playerId: joinedPlayerId,
        });
      });

      client.onPlayerLeave((leftPlayerId) => {
        set((s) => ({
          players: s.players.filter((p) => p.id !== leftPlayerId),
        }));
        postToIframe({
          type: 'sloppy:multiplayer:player_leave',
          playerId: leftPlayerId,
        });
      });

      client.onStateUpdate((state) => {
        // Measure ping from the last probe we sent.
        if (_pingStart > 0) {
          set({ ping: Math.round(performance.now() - _pingStart) });
          _pingStart = 0;
        }

        // Detect game-start broadcasts from the server.
        if (
          (state as Record<string, unknown>).gameStarted &&
          !get().isGameActive
        ) {
          set({ isGameActive: true, isModalOpen: false });
          postToIframe({
            type: 'sloppy:multiplayer:start',
            sessionId: get().session!.id,
            playerId: getPlayerId(),
            players: get().players.map((p) => ({
              id: p.id,
              displayName: p.displayName,
            })),
          });
        }
        postToIframe({ type: 'sloppy:multiplayer:state_update', state });
      });

      client.onError((error) => set({ error }));

      client.connect(sessionId, playerId);
      set({ client, disconnectReason: null });
    },

    disconnect: () => {
      stopPingLoop();
      get().client?.disconnect();
      set({ client: null, connectionState: 'disconnected' });
    },

    leaveSession: () => {
      _isLeaving = true;
      get().disconnect();
      set({
        session: null,
        players: [],
        isHost: false,
        isGameActive: false,
        isModalOpen: false,
        error: null,
        disconnectReason: 'left',
        ping: 0,
      });
      _isLeaving = false;
    },

    sendInput: (input) => {
      get().client?.sendInput(input);
    },

    clearError: () => set({ error: null }),

    reset: () => {
      _isLeaving = true;
      stopPingLoop();
      get().client?.disconnect();
      _isLeaving = false;
      _prevConnectionState = 'disconnected';
      set({
        session: null,
        connectionState: 'disconnected',
        players: [],
        ping: 0,
        isHost: false,
        isGameActive: false,
        isModalOpen: false,
        error: null,
        disconnectReason: null,
        client: null,
      });
    },
  };
});
