import { eq, sql, gte, and } from 'drizzle-orm';
import { generateId } from '@sloppy/shared';
import type { Database } from '../connection.js';
import { gameCrashLogs, games } from '../schema.js';

export interface CreateGameCrashLog {
  gameId: string;
  userId?: string;
  errorMessage: string;
  stackTrace?: string;
}

export interface GameCrashRepository {
  create(data: CreateGameCrashLog): Promise<{ id: string }>;
  getRecentCrashCount(gameId: string, windowHours?: number): Promise<number>;
  flagGameIfCrashing(gameId: string, threshold?: number): Promise<boolean>;
}

export function createGameCrashRepository(db: Database): GameCrashRepository {
  return {
    async create(data) {
      const id = generateId();
      await db.insert(gameCrashLogs).values({ id, ...data });
      return { id };
    },

    async getRecentCrashCount(gameId, windowHours = 1) {
      const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);
      const result = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(gameCrashLogs)
        .where(and(eq(gameCrashLogs.gameId, gameId), gte(gameCrashLogs.createdAt, since)));

      return result[0]?.count ?? 0;
    },

    async flagGameIfCrashing(gameId, threshold = 5) {
      const count = await this.getRecentCrashCount(gameId);
      if (count >= threshold) {
        await db
          .update(games)
          .set({ status: 'draft' })
          .where(eq(games.id, gameId));
        return true;
      }
      return false;
    },
  };
}
