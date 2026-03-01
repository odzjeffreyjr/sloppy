import { eq, sql, gte, and } from 'drizzle-orm';
import { generateId } from '@sloppy/shared';
import type { Database } from '../connection.js';
import { generationLogs } from '../schema.js';

export interface CreateGenerationLog {
  userId: string;
  gameId?: string;
  model: string;
  phase: string;
  promptTokens: number;
  completionTokens: number;
  totalCost: number;
  durationMs: number;
  status: 'success' | 'error' | 'timeout';
  error?: string;
}

export interface GenerationLogRepository {
  create(data: CreateGenerationLog): Promise<{ id: string }>;
  getDailyCost(date?: Date): Promise<number>;
  getCostByUser(userId: string, since?: Date): Promise<number>;
  getCostByModel(since?: Date): Promise<Array<{ model: string; totalCost: number; count: number }>>;
}

export function createGenerationLogRepository(db: Database): GenerationLogRepository {
  return {
    async create(data) {
      const id = generateId();
      await db.insert(generationLogs).values({ id, ...data });
      return { id };
    },

    async getDailyCost(date = new Date()) {
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);

      const result = await db
        .select({ total: sql<number>`coalesce(sum(${generationLogs.totalCost}), 0)` })
        .from(generationLogs)
        .where(gte(generationLogs.createdAt, dayStart));

      return result[0]?.total ?? 0;
    },

    async getCostByUser(userId, since) {
      const conditions = [eq(generationLogs.userId, userId)];
      if (since) conditions.push(gte(generationLogs.createdAt, since));

      const result = await db
        .select({ total: sql<number>`coalesce(sum(${generationLogs.totalCost}), 0)` })
        .from(generationLogs)
        .where(and(...conditions));

      return result[0]?.total ?? 0;
    },

    async getCostByModel(since) {
      const conditions = since ? [gte(generationLogs.createdAt, since)] : [];

      return db
        .select({
          model: generationLogs.model,
          totalCost: sql<number>`coalesce(sum(${generationLogs.totalCost}), 0)`,
          count: sql<number>`count(*)::int`,
        })
        .from(generationLogs)
        .where(conditions.length ? and(...conditions) : undefined)
        .groupBy(generationLogs.model);
    },
  };
}
