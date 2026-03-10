import { create } from 'zustand';
import { generationApi } from '../lib/api';
import { getIdToken } from '../lib/firebase';
import type { GenerationPhase, GenerationGameState } from '@sloppy/shared';

type StoreStatus = 'idle' | 'generating' | 'done' | 'error';

interface IterationInfo {
  attempt: number;
  maxAttempts: number;
  error: string;
}

interface ScreenshotMap {
  intro?: string;
  playing?: string;
  paused?: string;
  gameover?: string;
}

interface GenerationState {
  sessionId: string | null;
  gameId: string | null;
  status: StoreStatus;
  phase: GenerationPhase | 'idle' | 'done' | 'error';
  progress: number;
  message: string;
  error: string | null;
  prompt: string;
  gameTitle: string | null;
  gameDescription: string | null;
  cancelling: boolean;

  iteration: IterationInfo | null;
  iterationHistory: IterationInfo[];
  screenshots: ScreenshotMap;

  startGeneration: (prompt: string, existingGameId?: string) => Promise<void>;
  cancelGeneration: () => Promise<void>;
  reconnect: (sessionId: string, prompt?: string) => void;
  connectToSSE: (generationId: string) => Promise<void>;
  disconnect: () => void;
  reset: () => void;
  setExistingGame: (gameId: string, prompt: string) => void;
}

const MAX_SSE_RETRIES = 5;
const BASE_RETRY_MS = 1000;
const LS_KEY = 'sloppy:active-generation';

let activeEventSource: EventSource | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

function clearRetryTimer() {
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
}

function persistSession(sessionId: string, prompt: string) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ sessionId, prompt, ts: Date.now() }));
  } catch { /* quota exceeded or private mode */ }
}

function clearPersistedSession() {
  try { localStorage.removeItem(LS_KEY); } catch {}
}

export function getPersistedSession(): { sessionId: string; prompt: string; ts: number } | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.sessionId) return null;
    const age = Date.now() - (parsed.ts ?? 0);
    if (age > 3_600_000) {
      clearPersistedSession();
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

const INITIAL_STATE = {
  sessionId: null,
  gameId: null,
  status: 'idle' as StoreStatus,
  phase: 'idle' as const,
  progress: 0,
  message: '',
  error: null,
  prompt: '',
  gameTitle: null,
  gameDescription: null,
  cancelling: false,
  iteration: null,
  iterationHistory: [],
  screenshots: {},
};

export const useGenerationStore = create<GenerationState>()((set, get) => ({
  ...INITIAL_STATE,

  startGeneration: async (prompt, existingGameId) => {
    get().disconnect();
    set({
      ...INITIAL_STATE,
      status: 'generating',
      phase: 'concept',
      message: 'Starting...',
      prompt,
      gameId: existingGameId ?? null,
    });
    try {
      const res = await generationApi.start(prompt, existingGameId);
      const sessionId = res.data.sessionId;
      set({ sessionId });
      persistSession(sessionId, prompt);
      get().connectToSSE(sessionId);
    } catch (err) {
      set({ status: 'error', phase: 'error', error: err instanceof Error ? err.message : 'Generation failed' });
    }
  },

  cancelGeneration: async () => {
    const { sessionId, status, disconnect } = get();
    if (!sessionId || status !== 'generating') return;

    set({ cancelling: true });
    try {
      await generationApi.cancel(sessionId);
    } catch {
      // Best effort — still clean up locally
    }
    disconnect();
    clearPersistedSession();
    set({ ...INITIAL_STATE });
  },

  reconnect: (sessionId, prompt) => {
    get().disconnect();
    set({
      ...INITIAL_STATE,
      status: 'generating',
      phase: 'concept',
      message: 'Reconnecting...',
      sessionId,
      prompt: prompt ?? '',
    });
    get().connectToSSE(sessionId);
  },

  connectToSSE: async (generationId) => {
    get().disconnect();

    let retryCount = 0;

    async function connect() {
      const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';
      const token = await getIdToken();
      const qs = token ? `?token=${encodeURIComponent(token)}` : '';
      const eventSource = new EventSource(`${apiUrl}/generate/${generationId}/status${qs}`);
      activeEventSource = eventSource;

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          retryCount = 0;

          // v2 rich events (discriminated by `type` field)
          if (data.type) {
            handleV2Event(data);
            return;
          }

          // v1 fallback: flat { phase, progress, message, ... }
          handleV1Event(data);
        } catch {
          /* malformed event */
        }
      };

      eventSource.onerror = () => {
        eventSource.close();
        activeEventSource = null;

        const currentState = get();
        if (currentState.status !== 'generating') return;

        if (retryCount < MAX_SSE_RETRIES) {
          retryCount++;
          const delay = Math.min(BASE_RETRY_MS * 2 ** (retryCount - 1), 8000);
          set({ message: `Reconnecting... (attempt ${retryCount}/${MAX_SSE_RETRIES})` });
          clearRetryTimer();
          retryTimer = setTimeout(() => {
            if (get().status === 'generating') {
              connect();
            }
          }, delay);
        } else {
          clearPersistedSession();
          set({ status: 'error', phase: 'error', error: 'Connection to generation stream lost' });
        }
      };
    }

    function handleV2Event(data: Record<string, unknown>) {
      switch (data.type) {
        case 'phase':
          set({ phase: data.phase as GenerationPhase, iteration: null });
          break;

        case 'progress':
          set({
            progress: (data.percent as number) ?? get().progress,
            message: (data.message as string) ?? '',
          });
          break;

        case 'iteration': {
          const info: IterationInfo = {
            attempt: data.attempt as number,
            maxAttempts: data.maxAttempts as number,
            error: data.error as string,
          };
          set({
            iteration: info,
            iterationHistory: [...get().iterationHistory, info],
            phase: 'fixing',
          });
          break;
        }

        case 'screenshot': {
          const state = data.state as GenerationGameState;
          const imageBase64 = data.imageBase64 as string;
          // Store temporarily for display — component should clear after rendering
          set({ screenshots: { ...get().screenshots, [state]: imageBase64 } });
          break;
        }

        case 'complete':
          clearPersistedSession();
          set({
            status: 'done',
            phase: 'done',
            progress: 100,
            gameId: (data.gameId as string) ?? get().gameId,
          });
          activeEventSource?.close();
          activeEventSource = null;
          break;

        case 'failed':
          clearPersistedSession();
          if (data.reason === 'cancelled') {
            set({ ...INITIAL_STATE });
          } else {
            set({
              status: 'error',
              phase: 'error',
              error: (data.reason as string) ?? 'Generation failed',
            });
          }
          activeEventSource?.close();
          activeEventSource = null;
          break;
      }

      // Absorb title/description from any event that includes them
      if (data.title) set({ gameTitle: data.title as string });
      if (data.description) set({ gameDescription: data.description as string });
      if (data.gameId && data.type !== 'complete') set({ gameId: data.gameId as string });
    }

    function handleV1Event(data: Record<string, unknown>) {
      const updates: Partial<GenerationState> = {
        phase: (data.phase as GenerationPhase) ?? get().phase,
        progress: (data.progress as number) ?? get().progress,
        message: (data.message as string) ?? '',
      };

      if (data.title) updates.gameTitle = data.title as string;
      if (data.description) updates.gameDescription = data.description as string;
      if (data.gameId) updates.gameId = data.gameId as string;

      set(updates);

      if (data.phase === 'done' || data.completed) {
        clearPersistedSession();
        set({
          status: 'done',
          phase: 'done',
          progress: 100,
          gameId: (data.gameId as string) ?? get().gameId,
        });
        activeEventSource?.close();
        activeEventSource = null;
      }

      if (data.error) {
        clearPersistedSession();
        set({ status: 'error', phase: 'error', error: data.error as string });
        activeEventSource?.close();
        activeEventSource = null;
      }
    }

    await connect();
  },

  disconnect: () => {
    clearRetryTimer();
    if (activeEventSource) {
      activeEventSource.close();
      activeEventSource = null;
    }
  },

  reset: () => {
    get().disconnect();
    clearPersistedSession();
    set({ ...INITIAL_STATE });
  },

  setExistingGame: (gameId, prompt) => {
    get().disconnect();
    clearPersistedSession();
    set({ ...INITIAL_STATE, gameId, prompt, status: 'done', phase: 'done', progress: 100 });
  },
}));
