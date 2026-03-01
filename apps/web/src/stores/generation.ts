import { create } from 'zustand';
import { generationApi } from '../lib/api';
import { getIdToken } from '../lib/firebase';

type GenerationPhase = 'idle' | 'concept' | 'code' | 'assets' | 'multiplayer' | 'music' | 'done' | 'error';

interface GenerationState {
  sessionId: string | null;
  gameId: string | null;
  status: 'idle' | 'generating' | 'done' | 'error';
  phase: GenerationPhase;
  progress: number;
  message: string;
  error: string | null;
  prompt: string;
  gameTitle: string | null;
  gameDescription: string | null;

  startGeneration: (prompt: string) => Promise<void>;
  connectToSSE: (generationId: string) => Promise<void>;
  disconnect: () => void;
  reset: () => void;
}

const MAX_SSE_RETRIES = 5;
const BASE_RETRY_MS = 1000;

let activeEventSource: EventSource | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

function clearRetryTimer() {
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
}

export const useGenerationStore = create<GenerationState>()((set, get) => ({
  sessionId: null,
  gameId: null,
  status: 'idle',
  phase: 'idle',
  progress: 0,
  message: '',
  error: null,
  prompt: '',
  gameTitle: null,
  gameDescription: null,

  startGeneration: async (prompt) => {
    get().disconnect();
    set({
      status: 'generating',
      phase: 'concept',
      progress: 0,
      error: null,
      message: 'Starting...',
      prompt,
      gameId: null,
      gameTitle: null,
      gameDescription: null,
    });
    try {
      const res = await generationApi.start(prompt);
      const sessionId = res.data.sessionId;
      set({ sessionId });
      get().connectToSSE(sessionId);
    } catch (err) {
      set({ status: 'error', phase: 'error', error: err instanceof Error ? err.message : 'Generation failed' });
    }
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

          // Successful message resets retry counter
          retryCount = 0;

          const updates: Partial<GenerationState> = {
            phase: data.phase ?? get().phase,
            progress: data.progress ?? get().progress,
            message: data.message ?? '',
          };

          if (data.title) updates.gameTitle = data.title;
          if (data.description) updates.gameDescription = data.description;
          if (data.gameId) updates.gameId = data.gameId;

          set(updates);

          if (data.phase === 'done' || data.completed) {
            set({
              status: 'done',
              phase: 'done',
              progress: 100,
              gameId: data.gameId ?? get().gameId,
            });
            eventSource.close();
            activeEventSource = null;
          }

          if (data.error) {
            set({ status: 'error', phase: 'error', error: data.error });
            eventSource.close();
            activeEventSource = null;
          }
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
          set({ status: 'error', phase: 'error', error: 'Connection to generation stream lost' });
        }
      };
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
    set({
      sessionId: null,
      gameId: null,
      status: 'idle',
      phase: 'idle',
      progress: 0,
      message: '',
      error: null,
      prompt: '',
      gameTitle: null,
      gameDescription: null,
    });
  },
}));
