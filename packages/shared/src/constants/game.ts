/** Maximum total bundle size for a single game (bytes). 5 MB. */
export const MAX_GAME_SIZE_BYTES = 5 * 1024 * 1024;

/** Maximum individual asset file size (bytes). 1 MB. */
export const MAX_ASSET_SIZE_BYTES = 1 * 1024 * 1024;

/** Supported asset MIME types for generated games. */
export const SUPPORTED_ASSET_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
  'image/gif',
  'audio/mpeg',
  'audio/ogg',
  'audio/wav',
] as const;

export type SupportedAssetType = (typeof SUPPORTED_ASSET_TYPES)[number];

/** Default max players for multiplayer sessions. */
export const DEFAULT_MAX_PLAYERS = 4;

/** Absolute cap on multiplayer session size. */
export const ABSOLUTE_MAX_PLAYERS = 16;

/** Game slug maximum length. */
export const MAX_SLUG_LENGTH = 80;

/** Game title maximum length. */
export const MAX_TITLE_LENGTH = 120;

/** Game description maximum length. */
export const MAX_DESCRIPTION_LENGTH = 500;
