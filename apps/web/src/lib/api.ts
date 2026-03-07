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
    ...((options.headers as Record<string, string>) ?? {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const method = (options.method ?? 'GET').toUpperCase();
  if (method !== 'GET' && method !== 'HEAD') {
    headers['Content-Type'] ??= 'application/json';
  }

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
  genre: string | null;
  engine: string;
  thumbnailUrl: string | null;
  thumbnailSmUrl: string | null;
  supportsMultiplayer: boolean;
  version: number;
  status: string;
  playCount: number;
  favouriteCount: number;
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
  mine: (opts: { cursor?: string; limit?: number } = {}) => {
    const params = new URLSearchParams();
    if (opts.cursor) params.set('cursor', opts.cursor);
    if (opts.limit) params.set('limit', String(opts.limit));
    const qs = params.toString();
    return request<CursorPaginatedResponse<GameFeedItem>>(
      `${V1}/games/mine${qs ? `?${qs}` : ''}`,
    );
  },
  play: (id: string) =>
    request<{ data: { counted: boolean } }>(
      `${V1}/games/${id}/play`,
      { method: 'POST' },
    ),
  saveDraft: (gameId: string) =>
    request<{ data: GameFeedItem }>(`${V1}/games/${gameId}`),
  publish: (gameId: string) =>
    request<{ data: GameFeedItem }>(
      `${V1}/games/${gameId}/publish`,
      { method: 'POST' },
    ),
  search: (opts: {
    query?: string;
    genre?: string;
    engine?: string;
    multiplayer?: boolean;
    sort?: string;
    cursor?: string;
    limit?: number;
  } = {}) => {
    const params = new URLSearchParams();
    if (opts.query) params.set('q', opts.query);
    if (opts.genre) params.set('genre', opts.genre);
    if (opts.engine) params.set('engine', opts.engine);
    if (opts.multiplayer) params.set('multiplayer', 'true');
    if (opts.sort) params.set('sort', opts.sort);
    if (opts.cursor) params.set('cursor', opts.cursor);
    if (opts.limit) params.set('limit', String(opts.limit));
    const qs = params.toString();
    return request<CursorPaginatedResponse<GameFeedItem>>(
      `${V1}/games/search${qs ? `?${qs}` : ''}`,
    );
  },
  getByGenre: (genre: string, opts: { sort?: string; cursor?: string; limit?: number } = {}) => {
    const params = new URLSearchParams();
    params.set('genre', genre);
    if (opts.sort) params.set('sort', opts.sort);
    if (opts.cursor) params.set('cursor', opts.cursor);
    if (opts.limit) params.set('limit', String(opts.limit));
    const qs = params.toString();
    return request<CursorPaginatedResponse<GameFeedItem>>(
      `${V1}/games/search?${qs}`,
    );
  },
  getTrending: (opts: { hours?: number; limit?: number } = {}) => {
    const params = new URLSearchParams();
    if (opts.hours) params.set('hours', String(opts.hours));
    if (opts.limit) params.set('limit', String(opts.limit));
    const qs = params.toString();
    return request<{ data: GameFeedItem[] }>(
      `${V1}/games/trending${qs ? `?${qs}` : ''}`,
    );
  },
  getFeatured: (limit = 5) =>
    request<{ data: GameFeedItem[] }>(
      `${V1}/games/featured?limit=${limit}`,
    ),
  regenerateThumbnail: (gameId: string) =>
    request<{ data: { thumbnailUrl: string; thumbnailSmUrl: string } }>(
      `${V1}/thumbnails/regenerate/${gameId}`,
      { method: 'POST' },
    ),
};

// ── TikTok Feed ──────────────────────────────────────────────────────

export interface GameProgressData {
  userId: string;
  gameId: string;
  progressData: unknown;
  playTimeMs: number;
  lastPlayed: string;
  playCount: number;
}

export const tikTokFeedApi = {
  algorithm: (opts: { cursor?: string; limit?: number } = {}) => {
    const params = new URLSearchParams();
    if (opts.cursor) params.set('cursor', opts.cursor);
    if (opts.limit) params.set('limit', String(opts.limit));
    const qs = params.toString();
    return request<CursorPaginatedResponse<GameFeedItem>>(
      `${V1}/games/feed/algorithm${qs ? `?${qs}` : ''}`,
    );
  },
  saveProgress: (gameId: string, data: { progressData?: unknown; playTimeMs?: number; playCount?: number }) =>
    request<{ data: GameProgressData }>(
      `${V1}/games/${gameId}/progress`,
      { method: 'POST', body: JSON.stringify(data) },
    ),
  getProgress: (gameId: string) =>
    request<{ data: GameProgressData | null }>(
      `${V1}/games/${gameId}/progress`,
    ),
  trackEvent: (gameId: string, eventType: string, durationMs?: number) =>
    request<void>(
      `${V1}/games/${gameId}/feed-event`,
      { method: 'POST', body: JSON.stringify({ eventType, durationMs }) },
    ).catch(() => {}),
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
};

// ── Generation ────────────────────────────────────────────────────────

export const generationApi = {
  start: (prompt: string, gameId?: string) =>
    request<{ data: { sessionId: string } }>(
      `${V1}/generate`,
      { method: 'POST', body: JSON.stringify({ prompt, ...(gameId && { gameId }) }) },
    ),
  status: (id: string) =>
    request<{ data: { phase: string; progress: number; message: string; error?: string } }>(
      `${V1}/generate/${id}/status`,
    ),
};

// ── Subscription / Payments ───────────────────────────────────────────

export const subscriptionApi = {
  getStatus: () =>
    request<{
      data: {
        status: 'none' | 'active' | 'past_due' | 'canceled';
        isSubscribed: boolean;
        currentPeriodEnd: string | null;
      };
    }>(`${V1}/payments/subscription`),

  createCheckout: (opts: { successUrl: string; cancelUrl: string }) =>
    request<{ data: { checkoutUrl: string } }>(
      `${V1}/payments/subscribe`,
      { method: 'POST', body: JSON.stringify(opts) },
    ),

  cancel: () =>
    request<{ data: { canceled: boolean } }>(
      `${V1}/payments/cancel`,
      { method: 'POST' },
    ),

  portal: (opts: { returnUrl: string }) =>
    request<{ data: { portalUrl: string } }>(
      `${V1}/payments/portal`,
      { method: 'POST', body: JSON.stringify(opts) },
    ),
};

// ── Ads ───────────────────────────────────────────────────────────────

export const adsApi = {
  trackImpression: (data: {
    adProvider: string;
    format: string;
    gameId?: string;
    creatorId?: string;
  }) => {
    fetch(`${BASE_URL}${V1}/payments/ad-impression`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      keepalive: true,
    }).catch(() => {});
  },

  getEarnings: (creatorId?: string, month?: string) => {
    const params = new URLSearchParams();
    if (creatorId) params.set('creatorId', creatorId);
    if (month) params.set('month', month);
    return request<{
      data: {
        earnings?: Array<{
          id: string;
          creatorId: string;
          gameId: string | null;
          periodMonth: string;
          grossRevenue: string;
          creatorShare: string;
          platformShare: string;
          status: string;
        }>;
        totalBalance?: number;
        grossRevenue?: number;
        creatorShare?: number;
        platformShare?: number;
        impressionCount?: number;
      };
    }>(`${V1}/payments/earnings?${params.toString()}`);
  },
};

// ── Payments / Earnings ───────────────────────────────────────────────

export interface EarningsRecord {
  id: string;
  creatorId: string;
  gameId: string | null;
  periodMonth: string;
  grossRevenue: string;
  creatorShare: string;
  platformShare: string;
  status: string;
}

export interface ConnectStatus {
  hasAccount: boolean;
  onboardingComplete: boolean;
  payoutBalance: number;
  totalPaidOut: number;
}

export interface PayoutRecord {
  id: string;
  amount: number;
  status: 'processing' | 'completed' | 'failed';
  createdAt: string;
}

export const paymentsApi = {
  getBalance: () =>
    request<{
      data: {
        balance: number;
        totalEarned: number;
        totalPaidOut: number;
      };
    }>(`${V1}/payments/balance`),

  requestPayout: () =>
    request<{ data: { payoutId: string; amount: number; status: string } }>(
      `${V1}/payments/request-payout`,
      { method: 'POST' },
    ),

  connectStripe: () =>
    request<{ data: { onboardingUrl: string } }>(
      `${V1}/payments/connect-stripe`,
      { method: 'POST' },
    ),

  getConnectStatus: () =>
    request<{ data: ConnectStatus }>(`${V1}/payments/connect-status`),

  getEarnings: (period?: string) => {
    const params = new URLSearchParams();
    if (period) params.set('period', period);
    const qs = params.toString();
    return request<{
      data: {
        earnings: EarningsRecord[];
        totalBalance: number;
        grossRevenue: number;
        creatorShare: number;
      };
    }>(`${V1}/payments/earnings${qs ? `?${qs}` : ''}`);
  },

  getPayoutHistory: () =>
    request<{ data: PayoutRecord[] }>(`${V1}/payments/payouts`),
};

// ── Users / Profiles ──────────────────────────────────────────────────

export interface CreatorProfile {
  id: string;
  displayName: string;
  createdAt: string;
  gameCount: number;
  totalPlayCount: number;
}

export const usersApi = {
  getProfile: (userId: string) =>
    request<{ data: CreatorProfile }>(`${V1}/auth/profile/${userId}`),
};

// ── Creator Games (public) ────────────────────────────────────────────

export const creatorGamesApi = {
  getByCreator: (creatorId: string, opts: { cursor?: string; limit?: number } = {}) => {
    const params = new URLSearchParams();
    if (opts.cursor) params.set('cursor', opts.cursor);
    if (opts.limit) params.set('limit', String(opts.limit));
    const qs = params.toString();
    return request<CursorPaginatedResponse<GameFeedItem>>(
      `${V1}/games/creator/${creatorId}${qs ? `?${qs}` : ''}`,
    );
  },
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
      `${V1}/multiplayer/sessions`,
      { method: 'POST', body: JSON.stringify({ gameId, maxPlayers }) },
    ),
  get: (id: string) =>
    request<{ data: MultiplayerSessionData }>(`${V1}/multiplayer/sessions/${id}`),
  join: (id: string) =>
    request<{ data: MultiplayerSessionData }>(
      `${V1}/multiplayer/sessions/${id}/join`,
      { method: 'POST' },
    ),
};
