import type { User, Game, Favourite, MultiplayerSession } from '@sloppy/shared';
import type { users, games, favourites, sessions } from './schema.js';

type UserRow = typeof users.$inferSelect;
type GameRow = typeof games.$inferSelect;
type FavouriteRow = typeof favourites.$inferSelect;
type SessionRow = typeof sessions.$inferSelect;

export function mapUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName ?? undefined,
    createdAt: row.createdAt,
  };
}

export function mapGame(row: GameRow): Game {
  return {
    id: row.id,
    creatorId: row.creatorId,
    title: row.title,
    description: row.description,
    slug: row.slug,
    genre: (row.genre as Game['genre']) ?? null,
    engine: (row.engine as Game['engine']) ?? 'canvas2d',
    thumbnailUrl: row.thumbnailUrl ?? null,
    thumbnailSmUrl: row.thumbnailSmUrl ?? null,
    supportsMultiplayer: row.supportsMultiplayer,
    version: row.version,
    status: row.status as Game['status'],
    playCount: row.playCount,
    favouriteCount: row.favouriteCount,
    storagePath: row.storagePath,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function mapFavourite(row: FavouriteRow): Favourite {
  return {
    userId: row.userId,
    gameId: row.gameId,
    createdAt: row.createdAt,
  };
}

export function mapSession(row: SessionRow): MultiplayerSession {
  return {
    id: row.id,
    gameId: row.gameId,
    hostId: row.hostId,
    status: row.status as MultiplayerSession['status'],
    playerCount: row.playerCount,
    maxPlayers: row.maxPlayers,
    createdAt: row.createdAt,
  };
}
