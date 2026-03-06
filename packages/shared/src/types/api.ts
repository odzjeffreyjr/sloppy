import type { Game, GameFeedItem, GameStatus } from './game.js';
import type { Favourite } from './favourite.js';
import type { MultiplayerSession } from './multiplayer.js';
import type { GenerationRequest, GenerationStatus, GenerationEvent } from './generation.js';

// ---------------------------------------------------------------------------
// Generic API envelope
// ---------------------------------------------------------------------------

/** Standard success response wrapper. */
export interface ApiResponse<T> {
  data: T;
}

/** Standard error response. */
export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
}

/** Paginated list wrapper. */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// ---------------------------------------------------------------------------
// Games
// ---------------------------------------------------------------------------

export interface CreateGameRequest {
  title: string;
  description: string;
  supportsMultiplayer: boolean;
}

export interface UpdateGameRequest {
  title?: string;
  description?: string;
  status?: GameStatus;
  supportsMultiplayer?: boolean;
}

export type GetGameResponse = ApiResponse<Game>;
export type ListGamesResponse = PaginatedResponse<GameFeedItem>;
export type CreateGameResponse = ApiResponse<Game>;
export type UpdateGameResponse = ApiResponse<Game>;

// ---------------------------------------------------------------------------
// Favourites
// ---------------------------------------------------------------------------

export interface ToggleFavouriteRequest {
  gameId: string;
}

export type ListFavouritesResponse = PaginatedResponse<Favourite>;

// ---------------------------------------------------------------------------
// Multiplayer Sessions
// ---------------------------------------------------------------------------

export interface CreateSessionRequest {
  gameId: string;
  maxPlayers?: number;
}

export interface JoinSessionRequest {
  sessionId: string;
}

export type GetSessionResponse = ApiResponse<MultiplayerSession>;
export type CreateSessionResponse = ApiResponse<MultiplayerSession>;

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

export { GenerationRequest, GenerationEvent };

export type StartGenerationResponse = ApiResponse<{ generationId: string }>;
export type GenerationStatusResponse = ApiResponse<GenerationStatus>;
