/** Canonical API route paths. Use these instead of hard-coding strings. */
export const API_ROUTES = {
  // Auth
  AUTH_SYNC: '/auth/sync',
  AUTH_ME: '/auth/me',

  // Games
  GAMES: '/games',
  GAME_BY_ID: '/games/:id',
  GAME_BY_SLUG: '/games/slug/:slug',
  GAME_FEED: '/games/feed',
  GAME_MINE: '/games/mine',
  GAME_PUBLISH: '/games/:id/publish',
  GAME_PLAY: '/games/:id/play',
  GAME_BUNDLE: '/games/:id/bundle',
  GAME_CRASH: '/games/:id/crash',

  // Favourites
  FAVOURITES: '/favourites',
  FAVOURITE_BY_GAME: '/favourites/:gameId',

  // Generation
  GENERATION_START: '/generate',
  GENERATION_STATUS: '/generate/:sessionId/status',

  // Multiplayer sessions
  SESSIONS: '/multiplayer/sessions',
  SESSION_BY_ID: '/multiplayer/sessions/:id',
  SESSION_JOIN: '/multiplayer/sessions/:id/join',

  // Health
  HEALTH: '/health',
} as const;

export type ApiRoute = (typeof API_ROUTES)[keyof typeof API_ROUTES];
