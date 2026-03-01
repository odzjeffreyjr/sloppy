import { getIdToken } from './firebase';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';
const V1 = '';

interface ApiError {
  error: string;
  message: string;
  statusCode: number;
}

class SloppyApiError extends Error {
  constructor(
    public statusCode: number,
    public errorCode: string,
    message: string,
  ) {
    super(message);
    this.name = 'SloppyApiError';
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = await getIdToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) ?? {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    const body: ApiError = await res.json().catch(() => ({
      error: 'UNKNOWN',
      message: res.statusText,
      statusCode: res.status,
    }));
    throw new SloppyApiError(body.statusCode, body.error, body.message);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

// ── Auth ──────────────────────────────────────────────────────────────

export const authApi = {
  sync: () => request<{ data: { id: string; email: string; displayName?: string } }>(
    `${V1}/auth/sync`,
    { method: 'POST' },
  ),
  me: () => request<{ data: { id: string; email: string; displayName?: string } }>(
    `${V1}/auth/me`,
  ),
};

// ── Games ─────────────────────────────────────────────────────────────

export interface GameFeedItem {
  id: string;
  creatorId: string;
  title: string;
  description: string;
  slug: string;
  supportsMultiplayer: boolean;
  version: number;
  status: string;
  playCount: number;
  storagePath: string | null;
  isFavourited: boolean;
  creatorDisplayName: string;
  createdAt: string;
  updatedAt: string;
}

export type FeedSort = 'recent' | 'popular' | 'random';

interface CursorPaginatedResponse<T> {
  data: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export const gamesApi = {
  feed: (opts: { cursor?: string; limit?: number; sort?: FeedSort } = {}) => {
    const params = new URLSearchParams();
    if (opts.cursor) params.set('cursor', opts.cursor);
    if (opts.limit) params.set('limit', String(opts.limit));
    if (opts.sort) params.set('sort', opts.sort);
    const qs = params.toString();
    return request<CursorPaginatedResponse<GameFeedItem>>(
      `${V1}/games/feed${qs ? `?${qs}` : ''}`,
    );
  },
  get: (id: string) =>
    request<{ data: GameFeedItem }>(`${V1}/games/${id}`),
  getBySlug: (slug: string) =>
    request<{ data: GameFeedItem }>(`${V1}/games/slug/${slug}`),
  play: (id: string) =>
    request<{ data: { playCount: number } }>(
      `${V1}/games/${id}/play`,
      { method: 'POST' },
    ),
  saveDraft: (gameId: string) =>
    request<{ data: GameFeedItem }>(
      `${V1}/games/${gameId}/status`,
      { method: 'PATCH', body: JSON.stringify({ status: 'draft' }) },
    ),
  publish: (gameId: string) =>
    request<{ data: GameFeedItem }>(
      `${V1}/games/${gameId}/status`,
      { method: 'PATCH', body: JSON.stringify({ status: 'published' }) },
    ),
};

// ── Favourites ────────────────────────────────────────────────────────

export type FavouritesSort = 'recent' | 'most_played';

export const favouritesApi = {
  list: (opts: { cursor?: string; limit?: number; sort?: FavouritesSort } = {}) => {
    const params = new URLSearchParams();
    if (opts.cursor) params.set('cursor', opts.cursor);
    if (opts.limit) params.set('limit', String(opts.limit));
    if (opts.sort) params.set('sort', opts.sort);
    const qs = params.toString();
    return request<CursorPaginatedResponse<GameFeedItem>>(
      `${V1}/favourites${qs ? `?${qs}` : ''}`,
    );
  },
  add: (gameId: string) =>
    request<{ data: { favourited: boolean } }>(
      `${V1}/favourites/${gameId}`,
      { method: 'POST' },
    ),
  remove: (gameId: string) =>
    request<void>(
      `${V1}/favourites/${gameId}`,
      { method: 'DELETE' },
    ),
  toggle: (gameId: string) =>
    request<{ data: { favourited: boolean } }>(
      `${V1}/favourites/toggle`,
      { method: 'POST', body: JSON.stringify({ gameId }) },
    ),
};

// ── Generation ────────────────────────────────────────────────────────

export const generationApi = {
  start: (prompt: string) =>
    request<{ data: { generationId: string } }>(
      `${V1}/generation/start`,
      { method: 'POST', body: JSON.stringify({ prompt }) },
    ),
  status: (id: string) =>
    request<{ data: { phase: string; progress: number; message: string; error?: string } }>(
      `${V1}/generation/${id}/status`,
    ),
};

// ── Multiplayer Sessions ──────────────────────────────────────────────

export interface MultiplayerSessionData {
  id: string;
  gameId: string;
  hostId: string;
  status: string;
  playerCount: number;
  maxPlayers: number;
  createdAt: string;
}

export const sessionsApi = {
  create: (gameId: string, maxPlayers?: number) =>
    request<{ data: MultiplayerSessionData }>(
      `${V1}/sessions`,
      { method: 'POST', body: JSON.stringify({ gameId, maxPlayers }) },
    ),
  get: (id: string) =>
    request<{ data: MultiplayerSessionData }>(`${V1}/sessions/${id}`),
  join: (id: string) =>
    request<{ data: MultiplayerSessionData }>(
      `${V1}/sessions/${id}/join`,
      { method: 'POST' },
    ),
};
