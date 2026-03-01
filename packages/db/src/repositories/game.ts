import { eq, and, desc, isNull, sql, lt, or } from 'drizzle-orm';
import type { Game, GameFeedItem, GameStatus } from '@sloppy/shared';
import { generateId } from '@sloppy/shared';
import type { Database } from '../connection.js';
import { games, users, favourites } from '../schema.js';
import { mapGame } from '../mappers.js';
import {
  encodeCursor,
  decodeCursor,
  type CursorPage,
} from '../cursor.js';

export type FeedSort = 'recent' | 'popular' | 'random';

interface FeedCursor {
  id: string;
  sortValue: string;
  seed?: string;
}

const notDeleted = isNull(games.deletedAt);

const favouriteCountSql = sql<number>`(
  SELECT count(*)::int FROM favourites WHERE favourites.game_id = ${games.id}
)`;

function isFavouritedSql(userId: string) {
  return sql<boolean>`exists(
    SELECT 1 FROM favourites
    WHERE favourites.game_id = ${games.id}
      AND favourites.user_id = ${userId}
  )`;
}

export function createGameRepository(db: Database) {
  return {
    async create(data: {
      creatorId: string;
      title: string;
      description: string;
      slug: string;
      supportsMultiplayer?: boolean;
      storagePath?: string;
    }): Promise<Game> {
      const [row] = await db
        .insert(games)
        .values({
          id: generateId(),
          creatorId: data.creatorId,
          title: data.title,
          description: data.description,
          slug: data.slug,
          supportsMultiplayer: data.supportsMultiplayer ?? false,
          storagePath: data.storagePath ?? null,
        })
        .returning();
      return mapGame(row);
    },

    async update(
      id: string,
      data: {
        title?: string;
        description?: string;
        status?: GameStatus;
        supportsMultiplayer?: boolean;
        storagePath?: string;
        version?: number;
      },
    ): Promise<Game | null> {
      const [row] = await db
        .update(games)
        .set({ ...data, updatedAt: new Date() })
        .where(and(eq(games.id, id), notDeleted))
        .returning();
      return row ? mapGame(row) : null;
    },

    async findById(id: string): Promise<Game | null> {
      const [row] = await db
        .select()
        .from(games)
        .where(and(eq(games.id, id), notDeleted));
      return row ? mapGame(row) : null;
    },

    async findBySlug(slug: string): Promise<Game | null> {
      const [row] = await db
        .select()
        .from(games)
        .where(and(eq(games.slug, slug), notDeleted));
      return row ? mapGame(row) : null;
    },

    async findByCreator(
      creatorId: string,
      cursor?: string,
      limit = 20,
    ): Promise<CursorPage<Game>> {
      const conditions = [eq(games.creatorId, creatorId), notDeleted];

      if (cursor) {
        const c = decodeCursor<FeedCursor>(cursor);
        conditions.push(
          or(
            lt(games.createdAt, new Date(c.sortValue)),
            and(
              eq(games.createdAt, new Date(c.sortValue)),
              lt(games.id, c.id),
            ),
          )!,
        );
      }

      const rows = await db
        .select()
        .from(games)
        .where(and(...conditions))
        .orderBy(desc(games.createdAt), desc(games.id))
        .limit(limit + 1);

      const hasMore = rows.length > limit;
      const data = rows.slice(0, limit).map(mapGame);
      const last = data[data.length - 1];

      return {
        data,
        hasMore,
        nextCursor:
          hasMore && last
            ? encodeCursor({
                id: last.id,
                sortValue: last.createdAt.toISOString(),
              })
            : null,
      };
    },

    async getFeed(params: {
      cursor?: string;
      limit?: number;
      sort?: FeedSort;
      userId?: string;
      seed?: string;
    }): Promise<CursorPage<GameFeedItem>> {
      const { cursor, limit = 20, sort = 'recent', userId, seed } = params;

      const published = eq(games.status, 'published');
      const conditions = [published, notDeleted];

      const isFav = userId
        ? isFavouritedSql(userId)
        : sql<boolean>`false`;

      if (sort === 'recent') {
        if (cursor) {
          const c = decodeCursor<FeedCursor>(cursor);
          conditions.push(
            or(
              lt(games.createdAt, new Date(c.sortValue)),
              and(
                eq(games.createdAt, new Date(c.sortValue)),
                lt(games.id, c.id),
              ),
            )!,
          );
        }

        const rows = await db
          .select({
            game: games,
            creatorDisplayName: users.displayName,
            isFavourited: isFav,
          })
          .from(games)
          .innerJoin(users, eq(users.id, games.creatorId))
          .where(and(...conditions))
          .orderBy(desc(games.createdAt), desc(games.id))
          .limit(limit + 1);

        return buildFeedPage(rows, limit, (last) => ({
          id: last.game.id,
          sortValue: last.game.createdAt.toISOString(),
        }));
      }

      if (sort === 'popular') {
        const engagementScore = sql<number>`(${games.playCount} + ${favouriteCountSql})`;

        if (cursor) {
          const c = decodeCursor<FeedCursor>(cursor);
          const score = parseInt(c.sortValue, 10);
          conditions.push(
            or(
              sql`${engagementScore} < ${score}`,
              and(
                sql`${engagementScore} = ${score}`,
                lt(games.id, c.id),
              ),
            )!,
          );
        }

        const rows = await db
          .select({
            game: games,
            creatorDisplayName: users.displayName,
            isFavourited: isFav,
            engagementScore,
          })
          .from(games)
          .innerJoin(users, eq(users.id, games.creatorId))
          .where(and(...conditions))
          .orderBy(sql`${engagementScore} DESC`, desc(games.id))
          .limit(limit + 1);

        return buildFeedPage(rows, limit, (last) => ({
          id: last.game.id,
          sortValue: String(last.engagementScore),
        }));
      }

      // sort === 'random': deterministic pseudo-random using md5(id || seed)
      const randomSeed = seed ?? 'default';
      const randomOrder = sql`md5(${games.id} || ${randomSeed})`;

      if (cursor) {
        const c = decodeCursor<FeedCursor>(cursor);
        conditions.push(
          or(
            sql`md5(${games.id} || ${randomSeed}) > ${c.sortValue}`,
            and(
              sql`md5(${games.id} || ${randomSeed}) = ${c.sortValue}`,
              sql`${games.id} > ${c.id}`,
            ),
          )!,
        );
      }

      const rows = await db
        .select({
          game: games,
          creatorDisplayName: users.displayName,
          isFavourited: isFav,
          randomHash: randomOrder,
        })
        .from(games)
        .innerJoin(users, eq(users.id, games.creatorId))
        .where(and(...conditions))
        .orderBy(sql`${randomOrder} ASC`, sql`${games.id} ASC`)
        .limit(limit + 1);

      return buildFeedPage(rows, limit, (last) => ({
        id: last.game.id,
        sortValue: last.randomHash as string,
        seed: randomSeed,
      }));
    },

    async getFavouritedGames(params: {
      userId: string;
      cursor?: string;
      limit?: number;
    }): Promise<CursorPage<GameFeedItem>> {
      const { userId, cursor, limit = 20 } = params;

      const conditions = [
        eq(favourites.userId, userId),
        notDeleted,
      ];

      if (cursor) {
        const c = decodeCursor<FeedCursor>(cursor);
        conditions.push(
          or(
            lt(favourites.createdAt, new Date(c.sortValue)),
            and(
              eq(favourites.createdAt, new Date(c.sortValue)),
              lt(favourites.gameId, c.id),
            ),
          )!,
        );
      }

      const rows = await db
        .select({
          game: games,
          creatorDisplayName: users.displayName,
          isFavourited: sql<boolean>`true`,
          favCreatedAt: favourites.createdAt,
        })
        .from(favourites)
        .innerJoin(games, eq(games.id, favourites.gameId))
        .innerJoin(users, eq(users.id, games.creatorId))
        .where(and(...conditions))
        .orderBy(desc(favourites.createdAt), desc(favourites.gameId))
        .limit(limit + 1);

      return buildFeedPage(rows, limit, (last) => ({
        id: last.game.id,
        sortValue: last.favCreatedAt.toISOString(),
      }));
    },

    async incrementPlayCount(id: string): Promise<void> {
      await db
        .update(games)
        .set({
          playCount: sql`${games.playCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(games.id, id));
    },

    async delete(id: string): Promise<boolean> {
      const [row] = await db
        .update(games)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(games.id, id), notDeleted))
        .returning({ id: games.id });
      return !!row;
    },
  };
}

function buildFeedPage<
  T extends {
    game: typeof games.$inferSelect;
    creatorDisplayName: string | null;
    isFavourited: boolean;
  },
>(
  rows: T[],
  limit: number,
  cursorFrom: (last: T) => Record<string, unknown>,
): CursorPage<GameFeedItem> {
  const hasMore = rows.length > limit;
  const sliced = rows.slice(0, limit);

  const data: GameFeedItem[] = sliced.map((r) => ({
    id: r.game.id,
    creatorId: r.game.creatorId,
    title: r.game.title,
    description: r.game.description,
    slug: r.game.slug,
    supportsMultiplayer: r.game.supportsMultiplayer,
    version: r.game.version,
    status: r.game.status as GameFeedItem['status'],
    playCount: r.game.playCount,
    storagePath: r.game.storagePath,
    createdAt: r.game.createdAt,
    updatedAt: r.game.updatedAt,
    isFavourited: r.isFavourited,
    creatorDisplayName: r.creatorDisplayName ?? 'Anonymous',
  }));

  const last = sliced[sliced.length - 1];

  return {
    data,
    hasMore,
    nextCursor: hasMore && last ? encodeCursor(cursorFrom(last)) : null,
  };
}

export type GameRepository = ReturnType<typeof createGameRepository>;
