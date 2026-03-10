import { eq, and, desc, isNull, isNotNull, sql, lt, or, gte, inArray } from 'drizzle-orm';
import type { Game, GameFeedItem, GameStatus, GameGenre, GameEngine } from '@sloppy/shared';
import { generateId } from '@sloppy/shared';
import type { Database } from '../connection.js';
import { games, users, favourites, feedEvents } from '../schema.js';
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

function isFavouritedSql(userId: string) {
  return sql<boolean>`exists(
    SELECT 1 FROM favourites
    WHERE favourites.game_id = ${games.id}
      AND favourites.user_id = ${userId}
  )`;
}

export interface GameSearchFilters {
  genre?: GameGenre;
  engine?: GameEngine;
  status?: GameStatus;
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
      genre?: string;
      engine?: string;
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
          genre: data.genre ?? null,
          engine: data.engine ?? 'canvas2d',
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
        genre?: string;
        engine?: string;
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

    async search(
      query: string,
      filters?: GameSearchFilters,
      cursor?: string,
      limit = 20,
    ): Promise<CursorPage<Game>> {
      const tsQuery = sql`plainto_tsquery('english', ${query})`;
      const rank = sql<number>`ts_rank(to_tsvector('english', ${games.title} || ' ' || ${games.description}), ${tsQuery})`;

      const conditions = [
        notDeleted,
        eq(games.status, 'published'),
        sql`to_tsvector('english', ${games.title} || ' ' || ${games.description}) @@ ${tsQuery}`,
      ];

      if (filters?.genre) conditions.push(eq(games.genre, filters.genre));
      if (filters?.engine) conditions.push(eq(games.engine, filters.engine));

      if (cursor) {
        const c = decodeCursor<FeedCursor>(cursor);
        const cursorRank = parseFloat(c.sortValue);
        conditions.push(
          or(
            sql`${rank} < ${cursorRank}`,
            and(sql`${rank} = ${cursorRank}`, lt(games.id, c.id)),
          )!,
        );
      }

      const rows = await db
        .select({ game: games, rank })
        .from(games)
        .where(and(...conditions))
        .orderBy(sql`${rank} DESC`, desc(games.id))
        .limit(limit + 1);

      const hasMore = rows.length > limit;
      const sliced = rows.slice(0, limit);
      const data = sliced.map((r) => mapGame(r.game));
      const lastRow = sliced[sliced.length - 1];

      return {
        data,
        hasMore,
        nextCursor:
          hasMore && lastRow
            ? encodeCursor({
                id: lastRow.game.id,
                sortValue: String(lastRow.rank),
              })
            : null,
      };
    },

    async getByGenre(
      genre: GameGenre,
      cursor?: string,
      limit = 20,
    ): Promise<CursorPage<Game>> {
      const conditions = [
        eq(games.genre, genre),
        eq(games.status, 'published'),
        notDeleted,
      ];

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

    async getByEngine(
      engine: GameEngine,
      cursor?: string,
      limit = 20,
    ): Promise<CursorPage<Game>> {
      const conditions = [
        eq(games.engine, engine),
        eq(games.status, 'published'),
        notDeleted,
      ];

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

    async getTrending(hours = 24, limit = 20, userId?: string): Promise<GameFeedItem[]> {
      const since = new Date(Date.now() - hours * 60 * 60 * 1000);

      const trendingQuery = db
        .select({
          gameId: feedEvents.gameId,
          score: sql<number>`count(*)::int`.as('score'),
        })
        .from(feedEvents)
        .where(
          and(
            gte(feedEvents.createdAt, since),
            inArray(feedEvents.eventType, ['play_start', 'favourite']),
          ),
        )
        .groupBy(feedEvents.gameId)
        .orderBy(desc(sql`count(*)`))
        .limit(limit)
        .as('trending');

      const isFav = userId
        ? isFavouritedSql(userId)
        : sql<boolean>`false`;

      const rows = await db
        .select({
          game: games,
          creatorDisplayName: users.displayName,
          isFavourited: isFav,
        })
        .from(games)
        .innerJoin(trendingQuery, eq(games.id, trendingQuery.gameId))
        .innerJoin(users, eq(users.id, games.creatorId))
        .where(and(eq(games.status, 'published'), notDeleted, isNotNull(games.storagePath)))
        .orderBy(desc(trendingQuery.score));

      return rows.map((r) => ({
        id: r.game.id,
        creatorId: r.game.creatorId,
        title: r.game.title,
        description: r.game.description,
        slug: r.game.slug,
        genre: r.game.genre as GameFeedItem['genre'] ?? null,
        engine: r.game.engine as GameFeedItem['engine'] ?? 'canvas2d',
        thumbnailUrl: r.game.thumbnailUrl ?? null,
        thumbnailSmUrl: r.game.thumbnailSmUrl ?? null,
        supportsMultiplayer: r.game.supportsMultiplayer,
        version: r.game.version,
        status: r.game.status as GameFeedItem['status'],
        playCount: r.game.playCount,
        favouriteCount: r.game.favouriteCount,
        storagePath: r.game.storagePath,
        createdAt: r.game.createdAt,
        updatedAt: r.game.updatedAt,
        isFavourited: r.isFavourited,
        creatorDisplayName: r.creatorDisplayName ?? 'Anonymous',
      }));
    },

    async getFeed(params: {
      cursor?: string;
      limit?: number;
      sort?: FeedSort;
      userId?: string;
      seed?: string;
      diversify?: boolean;
    }): Promise<CursorPage<GameFeedItem>> {
      const {
        cursor,
        limit = 20,
        sort = 'recent',
        userId,
        seed,
        diversify = false,
      } = params;

      const published = eq(games.status, 'published');
      const hasBundles = isNotNull(games.storagePath);
      const conditions = [published, notDeleted, hasBundles];

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

        const fetchLimit = diversify ? (limit + 1) * 2 : limit + 1;

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
          .limit(fetchLimit);

        if (diversify) {
          const diversified = applyGenreDiversity(rows, limit + 1);
          return buildFeedPage(diversified, limit, (last) => ({
            id: last.game.id,
            sortValue: last.game.createdAt.toISOString(),
          }));
        }

        return buildFeedPage(rows, limit, (last) => ({
          id: last.game.id,
          sortValue: last.game.createdAt.toISOString(),
        }));
      }

      if (sort === 'popular') {
        const engagementScore = sql<number>`(${games.playCount} + ${games.favouriteCount})`;

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

    async updateThumbnail(
      gameId: string,
      thumbnailUrl: string,
      thumbnailSmUrl: string | null,
    ): Promise<Game | null> {
      const [row] = await db
        .update(games)
        .set({ thumbnailUrl, thumbnailSmUrl, updatedAt: new Date() })
        .where(and(eq(games.id, gameId), notDeleted))
        .returning();
      return row ? mapGame(row) : null;
    },

    async incrementFavouriteCount(gameId: string): Promise<void> {
      await db
        .update(games)
        .set({
          favouriteCount: sql`${games.favouriteCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(games.id, gameId));
    },

    async decrementFavouriteCount(gameId: string): Promise<void> {
      await db
        .update(games)
        .set({
          favouriteCount: sql`GREATEST(${games.favouriteCount} - 1, 0)`,
          updatedAt: new Date(),
        })
        .where(eq(games.id, gameId));
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

    async countByCreator(creatorId: string): Promise<number> {
      const [result] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(games)
        .where(and(eq(games.creatorId, creatorId), notDeleted));
      return result?.count ?? 0;
    },

    async countRecentByCreator(
      creatorId: string,
      since: Date,
    ): Promise<number> {
      // Includes soft-deleted games so deleting+recreating doesn't bypass weekly limits
      const [result] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(games)
        .where(
          and(
            eq(games.creatorId, creatorId),
            gte(games.createdAt, since),
          ),
        );
      return result?.count ?? 0;
    },
  };
}

/**
 * Re-order rows so that the same genre doesn't appear consecutively.
 * Greedy: pick the next row whose genre differs from the last selected.
 */
function applyGenreDiversity<
  T extends { game: typeof games.$inferSelect },
>(rows: T[], maxLen: number): T[] {
  if (rows.length === 0) return rows;

  const remaining = [...rows];
  const result: T[] = [];
  let lastGenre: string | null = null;

  while (result.length < maxLen && remaining.length > 0) {
    const idx = remaining.findIndex(
      (r) => r.game.genre !== lastGenre || remaining.length === 1,
    );
    const pick = idx >= 0 ? idx : 0;
    const [item] = remaining.splice(pick, 1);
    lastGenre = item.game.genre;
    result.push(item);
  }

  return result;
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
    genre: (r.game.genre as GameFeedItem['genre']) ?? null,
    engine: (r.game.engine as GameFeedItem['engine']) ?? 'canvas2d',
    thumbnailUrl: r.game.thumbnailUrl ?? null,
    thumbnailSmUrl: r.game.thumbnailSmUrl ?? null,
    supportsMultiplayer: r.game.supportsMultiplayer,
    version: r.game.version,
    status: r.game.status as GameFeedItem['status'],
    playCount: r.game.playCount,
    favouriteCount: r.game.favouriteCount,
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
