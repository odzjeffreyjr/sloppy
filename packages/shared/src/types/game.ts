/** Supported rendering engines. canvas2d is the implicit engine for v1 games. */
export type GameEngine = 'phaser3' | 'threejs' | 'canvas2d';

/** Genre tags used across the platform. Re-exported from @sloppy/runtime-sdk for convenience. */
export type GameGenre =
  | '2d-platformer'
  | '2d-topdown'
  | '2d-puzzle'
  | '2d-arcade'
  | '3d-firstperson'
  | '3d-thirdperson'
  | '3d-racing'
  | '3d-puzzle';

/** Publication status of a game. */
export type GameStatus = 'draft' | 'published';

/** A game stored in the platform. */
export interface Game {
  id: string;
  creatorId: string;
  title: string;
  description: string;
  slug: string;
  genre: GameGenre | null;
  engine: GameEngine;
  thumbnailUrl: string | null;
  thumbnailSmUrl: string | null;
  supportsMultiplayer: boolean;
  version: number;
  status: GameStatus;
  playCount: number;
  favouriteCount: number;
  storagePath: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** A game as it appears in the scrollable feed, with extra display fields. */
export interface GameFeedItem extends Game {
  isFavourited: boolean;
  creatorDisplayName: string;
}
