import { eq, and, desc, lt, or, sql } from 'drizzle-orm';
import type { Favourite } from '@sloppy/shared';
import type { Database } from '../connection.js';
import { favourites } from '../schema.js';
import { mapFavourite } from '../mappers.js';
import {
  encodeCursor,
  decodeCursor,
  type CursorPage,
} from '../cursor.js';

interface FavCursor {
  createdAt: string;
  gameId: string;
}

export function createFavouriteRepository(db: Database) {
  return {
    async add(userId: string, gameId: string): Promise<Favourite> {
      const [row] = await db
        .insert(favourites)
        .values({ userId, gameId })
        .onConflictDoNothing()
        .returning();

      if (!row) {
        const [existing] = await db
          .select()
          .from(favourites)
          .where(
            and(
              eq(favourites.userId, userId),
              eq(favourites.gameId, gameId),
            ),
          );
        return mapFavourite(existing);
      }

      return mapFavourite(row);
    },

    async remove(userId: string, gameId: string): Promise<boolean> {
      const result = await db
        .delete(favourites)
        .where(
          and(
            eq(favourites.userId, userId),
            eq(favourites.gameId, gameId),
          ),
        )
        .returning();
      return result.length > 0;
    },

    async findByUser(
      userId: string,
      cursor?: string,
      limit = 20,
    ): Promise<CursorPage<Favourite>> {
      const conditions = [eq(favourites.userId, userId)];

      if (cursor) {
        const c = decodeCursor<FavCursor>(cursor);
        conditions.push(
          or(
            lt(favourites.createdAt, new Date(c.createdAt)),
            and(
              eq(favourites.createdAt, new Date(c.createdAt)),
              lt(favourites.gameId, c.gameId),
            ),
          )!,
        );
      }

      const rows = await db
        .select()
        .from(favourites)
        .where(and(...conditions))
        .orderBy(desc(favourites.createdAt), desc(favourites.gameId))
        .limit(limit + 1);

      const hasMore = rows.length > limit;
      const data = rows.slice(0, limit).map(mapFavourite);
      const last = data[data.length - 1];

      return {
        data,
        hasMore,
        nextCursor:
          hasMore && last
            ? encodeCursor({
                createdAt: last.createdAt.toISOString(),
                gameId: last.gameId,
              })
            : null,
      };
    },

    async isFavourited(userId: string, gameId: string): Promise<boolean> {
      const [row] = await db
        .select({ userId: favourites.userId })
        .from(favourites)
        .where(
          and(
            eq(favourites.userId, userId),
            eq(favourites.gameId, gameId),
          ),
        );
      return !!row;
    },

    async getFavouriteCount(gameId: string): Promise<number> {
      const [result] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(favourites)
        .where(eq(favourites.gameId, gameId));
      return result?.count ?? 0;
    },
  };
}

export type FavouriteRepository = ReturnType<typeof createFavouriteRepository>;
