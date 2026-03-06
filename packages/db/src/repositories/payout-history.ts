import { eq, desc } from 'drizzle-orm';
import { generateId } from '@sloppy/shared';
import type { Database } from '../connection.js';
import { payoutHistory } from '../schema.js';

export interface PayoutHistoryRecord {
  id: string;
  creatorId: string;
  stripeTransferId: string;
  amount: string;
  currency: string;
  status: 'processing' | 'completed' | 'failed';
  createdAt: Date;
}

function mapPayout(
  row: typeof payoutHistory.$inferSelect,
): PayoutHistoryRecord {
  return {
    id: row.id,
    creatorId: row.creatorId,
    stripeTransferId: row.stripeTransferId,
    amount: row.amount,
    currency: row.currency,
    status: row.status as PayoutHistoryRecord['status'],
    createdAt: row.createdAt,
  };
}

export function createPayoutHistoryRepository(db: Database) {
  return {
    async create(data: {
      creatorId: string;
      stripeTransferId: string;
      amount: number;
      currency?: string;
      status?: 'processing' | 'completed' | 'failed';
    }): Promise<PayoutHistoryRecord> {
      const [row] = await db
        .insert(payoutHistory)
        .values({
          id: generateId(),
          creatorId: data.creatorId,
          stripeTransferId: data.stripeTransferId,
          amount: data.amount.toFixed(2),
          currency: data.currency ?? 'usd',
          status: data.status ?? 'completed',
        })
        .returning();
      return mapPayout(row);
    },

    async getByCreator(creatorId: string): Promise<PayoutHistoryRecord[]> {
      const rows = await db
        .select()
        .from(payoutHistory)
        .where(eq(payoutHistory.creatorId, creatorId))
        .orderBy(desc(payoutHistory.createdAt));
      return rows.map(mapPayout);
    },

    async updateStatus(
      id: string,
      status: 'processing' | 'completed' | 'failed',
    ): Promise<PayoutHistoryRecord | null> {
      const [row] = await db
        .update(payoutHistory)
        .set({ status })
        .where(eq(payoutHistory.id, id))
        .returning();
      return row ? mapPayout(row) : null;
    },
  };
}

export type PayoutHistoryRepository = ReturnType<
  typeof createPayoutHistoryRepository
>;
