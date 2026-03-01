/** Publication status of a game. */
export type GameStatus = 'draft' | 'published';

/** A game stored in the platform. */
export interface Game {
  id: string;
  creatorId: string;
  title: string;
  description: string;
  slug: string;
  supportsMultiplayer: boolean;
  version: number;
  status: GameStatus;
  playCount: number;
  storagePath: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** A game as it appears in the scrollable feed, with extra display fields. */
export interface GameFeedItem extends Game {
  isFavourited: boolean;
  creatorDisplayName: string;
}
