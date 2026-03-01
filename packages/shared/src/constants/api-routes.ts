const v1 = '/api/v1';

/** Canonical API route paths. Use these instead of hard-coding strings. */
export const API_ROUTES = {
  // Auth
  AUTH_SYNC: `${v1}/auth/sync`,
  AUTH_ME: `${v1}/auth/me`,

  // Games
  GAMES: `${v1}/games`,
  GAME_BY_ID: `${v1}/games/:id`,
  GAME_BY_SLUG: `${v1}/games/slug/:slug`,

  // Favourites
  FAVOURITES: `${v1}/favourites`,
  FAVOURITE_TOGGLE: `${v1}/favourites/toggle`,

  // Generation
  GENERATION_START: `${v1}/generation/start`,
  GENERATION_STATUS: `${v1}/generation/:id/status`,

  // Multiplayer sessions
  SESSIONS: `${v1}/sessions`,
  SESSION_BY_ID: `${v1}/sessions/:id`,
  SESSION_JOIN: `${v1}/sessions/:id/join`,

  // Health
  HEALTH: `${v1}/health`,
} as const;

export type ApiRoute = (typeof API_ROUTES)[keyof typeof API_ROUTES];
