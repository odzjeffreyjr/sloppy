import { eq, and, desc, lt, or } from 'drizzle-orm';
import type { Database } from '../connection.js';
import { gameProgress } from '../schema.js';
import {
  encodeCursor,
  decodeCursor,
  type CursorPage,
} from '../cursor.js';

export interface GameProgressRecord {
  userId: string;
  gameId: string;
  progressData: unknown;
  playTimeMs: number;
  lastPlayed: Date;
  playCount: number;
}

interface ProgressCursor {
  gameId: string;
  lastPlayed: string;
}

function mapProgress(
  row: typeof gameProgress.$inferSelect,
): GameProgressRecord {
  return {
    userId: row.userId,
    gameId: row.gameId,
    progressData: row.progressData,
    playTimeMs: row.playTimeMs,
    lastPlayed: row.lastPlayed,
    playCount: row.playCount,
  };
}

export function createGameProgressRepository(db: Database) {
  return {
    async save(
      userId: string,
      gameId: string,
      data: {
        progressData?: unknown;
        playTimeMs?: number;
        playCount?: number;
      },
    ): Promise<GameProgressRecord> {
      const [row] = await db
        .insert(gameProgress)
        .values({
          userId,
          gameId,
          progressData: data.progressData ?? null,
          playTimeMs: data.playTimeMs ?? 0,
          playCount: data.playCount ?? 1,
          lastPlayed: new Date(),
        })
        .onConflictDoUpdate({
          target: [gameProgress.userId, gameProgress.gameId],
          set: {
            progressData: data.progressData ?? gameProgress.progressData,
            playTimeMs: data.playTimeMs ?? gameProgress.playTimeMs,
            playCount: data.playCount ?? gameProgress.playCount,
            lastPlayed: new Date(),
          },
        })
        .returning();
      return mapProgress(row);
    },

    async get(
      userId: string,
      gameId: string,
    ): Promise<GameProgressRecord | null> {
      const [row] = await db
        .select()
        .from(gameProgress)
        .where(
          and(
            eq(gameProgress.userId, userId),
            eq(gameProgress.gameId, gameId),
          ),
        );
      return row ? mapProgress(row) : null;
    },

    async getByUser(
      userId: string,
      cursor?: string,
      limit = 20,
    ): Promise<CursorPage<GameProgressRecord>> {
      const conditions = [eq(gameProgress.userId, userId)];

      if (cursor) {
        const c = decodeCursor<ProgressCursor>(cursor);
        conditions.push(
          or(
            lt(gameProgress.lastPlayed, new Date(c.lastPlayed)),
            and(
              eq(gameProgress.lastPlayed, new Date(c.lastPlayed)),
              lt(gameProgress.gameId, c.gameId),
            ),
          )!,
        );
      }

      const rows = await db
        .select()
        .from(gameProgress)
        .where(and(...conditions))
        .orderBy(desc(gameProgress.lastPlayed), desc(gameProgress.gameId))
        .limit(limit + 1);

      const hasMore = rows.length > limit;
      const data = rows.slice(0, limit).map(mapProgress);
      const last = data[data.length - 1];

      return {
        data,
        hasMore,
        nextCursor:
          hasMore && last
            ? encodeCursor({
                gameId: last.gameId,
                lastPlayed: last.lastPlayed.toISOString(),
              })
            : null,
      };
    },
  };
}

export type GameProgressRepository = ReturnType<
  typeof createGameProgressRepository
>;
