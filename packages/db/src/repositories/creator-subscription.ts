import { eq } from 'drizzle-orm';
import type { Database } from '../connection.js';
import { creatorSubscriptions } from '../schema.js';

export interface CreatorSubscriptionRecord {
  creatorId: string;
  stripeCustomerId: string | null;
  stripeSubId: string | null;
  status: 'active' | 'past_due' | 'canceled' | null;
  currentPeriodEnd: Date | null;
  createdAt: Date;
}

function mapSubscription(
  row: typeof creatorSubscriptions.$inferSelect,
): CreatorSubscriptionRecord {
  return {
    creatorId: row.creatorId,
    stripeCustomerId: row.stripeCustomerId,
    stripeSubId: row.stripeSubId,
    status: row.status as CreatorSubscriptionRecord['status'],
    currentPeriodEnd: row.currentPeriodEnd,
    createdAt: row.createdAt,
  };
}

export function createCreatorSubscriptionRepository(db: Database) {
  return {
    async upsert(data: {
      creatorId: string;
      stripeCustomerId: string;
      stripeSubId: string;
      status: 'active' | 'past_due' | 'canceled';
      currentPeriodEnd: Date;
    }): Promise<CreatorSubscriptionRecord> {
      const [row] = await db
        .insert(creatorSubscriptions)
        .values(data)
        .onConflictDoUpdate({
          target: creatorSubscriptions.creatorId,
          set: {
            stripeCustomerId: data.stripeCustomerId,
            stripeSubId: data.stripeSubId,
            status: data.status,
            currentPeriodEnd: data.currentPeriodEnd,
          },
        })
        .returning();
      return mapSubscription(row);
    },

    async get(
      creatorId: string,
    ): Promise<CreatorSubscriptionRecord | null> {
      const [row] = await db
        .select()
        .from(creatorSubscriptions)
        .where(eq(creatorSubscriptions.creatorId, creatorId));
      return row ? mapSubscription(row) : null;
    },

    async isActive(creatorId: string): Promise<boolean> {
      const [row] = await db
        .select({ status: creatorSubscriptions.status })
        .from(creatorSubscriptions)
        .where(eq(creatorSubscriptions.creatorId, creatorId));
      return row?.status === 'active';
    },
  };
}

export type CreatorSubscriptionRepository = ReturnType<
  typeof createCreatorSubscriptionRepository
>;
