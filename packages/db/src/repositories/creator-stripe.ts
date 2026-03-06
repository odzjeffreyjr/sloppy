import { eq, sql } from 'drizzle-orm';
import type { Database } from '../connection.js';
import { creatorStripeAccounts } from '../schema.js';

export interface CreatorStripeRecord {
  creatorId: string;
  stripeAccountId: string | null;
  onboardingComplete: boolean;
  payoutBalance: string;
  totalPaidOut: string;
  createdAt: Date;
}

function mapStripe(
  row: typeof creatorStripeAccounts.$inferSelect,
): CreatorStripeRecord {
  return {
    creatorId: row.creatorId,
    stripeAccountId: row.stripeAccountId,
    onboardingComplete: row.onboardingComplete,
    payoutBalance: row.payoutBalance,
    totalPaidOut: row.totalPaidOut,
    createdAt: row.createdAt,
  };
}

export function createCreatorStripeRepository(db: Database) {
  return {
    async upsert(
      creatorId: string,
      stripeAccountId: string,
    ): Promise<CreatorStripeRecord> {
      const [row] = await db
        .insert(creatorStripeAccounts)
        .values({ creatorId, stripeAccountId })
        .onConflictDoUpdate({
          target: creatorStripeAccounts.creatorId,
          set: { stripeAccountId },
        })
        .returning();
      return mapStripe(row);
    },

    async get(creatorId: string): Promise<CreatorStripeRecord | null> {
      const [row] = await db
        .select()
        .from(creatorStripeAccounts)
        .where(eq(creatorStripeAccounts.creatorId, creatorId));
      return row ? mapStripe(row) : null;
    },

    async updateBalance(
      creatorId: string,
      amount: number,
    ): Promise<CreatorStripeRecord | null> {
      const [row] = await db
        .update(creatorStripeAccounts)
        .set({
          payoutBalance: sql`${creatorStripeAccounts.payoutBalance}::numeric + ${amount}`,
        })
        .where(eq(creatorStripeAccounts.creatorId, creatorId))
        .returning();
      return row ? mapStripe(row) : null;
    },

    async markOnboardingComplete(
      creatorId: string,
    ): Promise<CreatorStripeRecord | null> {
      const [row] = await db
        .update(creatorStripeAccounts)
        .set({ onboardingComplete: true })
        .where(eq(creatorStripeAccounts.creatorId, creatorId))
        .returning();
      return row ? mapStripe(row) : null;
    },
  };
}

export type CreatorStripeRepository = ReturnType<
  typeof createCreatorStripeRepository
>;
