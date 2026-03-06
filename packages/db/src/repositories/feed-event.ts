import { eq, and, desc, sql } from 'drizzle-orm';
import { generateId } from '@sloppy/shared';
import type { Database } from '../connection.js';
import { feedEvents } from '../schema.js';

export type FeedEventType =
  | 'view'
  | 'play_start'
  | 'play_time'
  | 'skip'
  | 'favourite';

export interface FeedEventRecord {
  id: string;
  userId: string | null;
  gameId: string;
  eventType: FeedEventType;
  durationMs: number | null;
  createdAt: Date;
}

function mapFeedEvent(
  row: typeof feedEvents.$inferSelect,
): FeedEventRecord {
  return {
    id: row.id,
    userId: row.userId,
    gameId: row.gameId,
    eventType: row.eventType as FeedEventType,
    durationMs: row.durationMs,
    createdAt: row.createdAt,
  };
}

export function createFeedEventRepository(db: Database) {
  return {
    async create(data: {
      userId?: string;
      gameId: string;
      eventType: FeedEventType;
      durationMs?: number;
    }): Promise<FeedEventRecord> {
      const [row] = await db
        .insert(feedEvents)
        .values({
          id: generateId(),
          userId: data.userId ?? null,
          gameId: data.gameId,
          eventType: data.eventType,
          durationMs: data.durationMs ?? null,
        })
        .returning();
      return mapFeedEvent(row);
    },

    async getTrendingGameIds(hours = 24, limit = 50): Promise<string[]> {
      const since = new Date(Date.now() - hours * 60 * 60 * 1000);

      const rows = await db
        .select({
          gameId: feedEvents.gameId,
          score: sql<number>`count(*)::int`.as('score'),
        })
        .from(feedEvents)
        .where(
          and(
            sql`${feedEvents.createdAt} >= ${since}`,
            sql`${feedEvents.eventType} IN ('play_start', 'favourite')`,
          ),
        )
        .groupBy(feedEvents.gameId)
        .orderBy(desc(sql`count(*)`))
        .limit(limit);

      return rows.map((r) => r.gameId);
    },

    async getPlayCounts(
      gameIds: string[],
    ): Promise<Record<string, number>> {
      if (gameIds.length === 0) return {};

      const rows = await db
        .select({
          gameId: feedEvents.gameId,
          count: sql<number>`count(*)::int`.as('count'),
        })
        .from(feedEvents)
        .where(
          and(
            sql`${feedEvents.gameId} = ANY(${gameIds})`,
            eq(feedEvents.eventType, 'play_start'),
          ),
        )
        .groupBy(feedEvents.gameId);

      const result: Record<string, number> = {};
      for (const row of rows) {
        result[row.gameId] = row.count;
      }
      return result;
    },
  };
}

export type FeedEventRepository = ReturnType<
  typeof createFeedEventRepository
>;
