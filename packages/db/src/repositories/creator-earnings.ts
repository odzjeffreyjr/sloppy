import { eq, and, sql } from 'drizzle-orm';
import { generateId } from '@sloppy/shared';
import type { Database } from '../connection.js';
import { creatorEarnings } from '../schema.js';

export interface CreatorEarningsRecord {
  id: string;
  creatorId: string;
  gameId: string | null;
  periodMonth: Date;
  grossRevenue: string;
  creatorShare: string;
  platformShare: string;
  status: 'pending' | 'confirmed' | 'paid';
  createdAt: Date;
}

function mapEarnings(
  row: typeof creatorEarnings.$inferSelect,
): CreatorEarningsRecord {
  return {
    id: row.id,
    creatorId: row.creatorId,
    gameId: row.gameId,
    periodMonth: row.periodMonth,
    grossRevenue: row.grossRevenue,
    creatorShare: row.creatorShare,
    platformShare: row.platformShare,
    status: row.status as CreatorEarningsRecord['status'],
    createdAt: row.createdAt,
  };
}

export function createCreatorEarningsRepository(db: Database) {
  return {
    async create(data: {
      creatorId: string;
      gameId?: string;
      periodMonth: Date;
      grossRevenue: string;
      creatorShare: string;
      platformShare: string;
    }): Promise<CreatorEarningsRecord> {
      const [row] = await db
        .insert(creatorEarnings)
        .values({
          id: generateId(),
          creatorId: data.creatorId,
          gameId: data.gameId ?? null,
          periodMonth: data.periodMonth,
          grossRevenue: data.grossRevenue,
          creatorShare: data.creatorShare,
          platformShare: data.platformShare,
        })
        .returning();
      return mapEarnings(row);
    },

    async getByCreator(creatorId: string): Promise<CreatorEarningsRecord[]> {
      const rows = await db
        .select()
        .from(creatorEarnings)
        .where(eq(creatorEarnings.creatorId, creatorId))
        .orderBy(sql`${creatorEarnings.periodMonth} DESC`);
      return rows.map(mapEarnings);
    },

    async getByPeriod(
      creatorId: string,
      month: Date,
    ): Promise<CreatorEarningsRecord[]> {
      const rows = await db
        .select()
        .from(creatorEarnings)
        .where(
          and(
            eq(creatorEarnings.creatorId, creatorId),
            eq(creatorEarnings.periodMonth, month),
          ),
        );
      return rows.map(mapEarnings);
    },

    async getTotalBalance(creatorId: string): Promise<number> {
      const [result] = await db
        .select({
          total: sql<string>`COALESCE(SUM(${creatorEarnings.creatorShare}::numeric), 0)`,
        })
        .from(creatorEarnings)
        .where(
          and(
            eq(creatorEarnings.creatorId, creatorId),
            eq(creatorEarnings.status, 'confirmed'),
          ),
        );
      return parseFloat(result?.total ?? '0');
    },
  };
}

export type CreatorEarningsRepository = ReturnType<
  typeof createCreatorEarningsRepository
>;
