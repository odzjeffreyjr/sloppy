import type { Database, CreatorStripeRepository, PayoutHistoryRepository } from '@sloppy/db';
import { eq, and, sql, creatorEarnings, creatorStripeAccounts } from '@sloppy/db';
import { createLogger } from '@sloppy/logger';
import { createTransfer } from '../stripe/connect.js';
import type { PayoutCalculator } from './calculator.js';
import { config } from '../config.js';

const log = createLogger('payments:payout-trigger');

export function createPayoutTrigger(
  db: Database,
  stripeRepo: CreatorStripeRepository,
  calculator: PayoutCalculator,
  payoutHistoryRepo: PayoutHistoryRepository,
) {
  return {
    async requestPayout(
      creatorId: string,
    ): Promise<{ success: boolean; transferId?: string; amount?: number; error?: string }> {
      const eligibility = await calculator.canRequestPayout(creatorId);
      if (!eligibility.eligible) {
        return { success: false, error: eligibility.reason };
      }

      const stripeAccount = await stripeRepo.get(creatorId);
      if (!stripeAccount?.stripeAccountId) {
        return { success: false, error: 'No Stripe account linked' };
      }

      const balance = eligibility.balance;

      try {
        const transfer = await createTransfer(
          balance,
          config.payout.currency,
          stripeAccount.stripeAccountId,
          { creatorId, payoutType: 'ad_revenue' },
        );

        await db
          .update(creatorEarnings)
          .set({ status: 'paid' })
          .where(
            and(
              eq(creatorEarnings.creatorId, creatorId),
              eq(creatorEarnings.status, 'confirmed'),
            ),
          );

        await db
          .update(creatorStripeAccounts)
          .set({
            payoutBalance: '0',
            totalPaidOut: sql`${creatorStripeAccounts.totalPaidOut}::numeric + ${balance}`,
          })
          .where(eq(creatorStripeAccounts.creatorId, creatorId));

        await payoutHistoryRepo.create({
          creatorId,
          stripeTransferId: transfer.id,
          amount: balance,
          currency: config.payout.currency,
          status: 'completed',
        });

        log.info(
          { creatorId, amount: balance, transferId: transfer.id },
          'Payout completed',
        );

        return { success: true, transferId: transfer.id, amount: balance };
      } catch (err) {
        log.error(
          { error: (err as Error).message, creatorId, amount: balance },
          'Payout transfer failed',
        );
        return { success: false, error: 'Transfer failed — please try again later' };
      }
    },

    async getEligibleCreators(): Promise<string[]> {
      const rows = await db
        .select({
          creatorId: creatorEarnings.creatorId,
          total: sql<string>`SUM(${creatorEarnings.creatorShare}::numeric)`,
        })
        .from(creatorEarnings)
        .where(eq(creatorEarnings.status, 'confirmed'))
        .groupBy(creatorEarnings.creatorId)
        .having(sql`SUM(${creatorEarnings.creatorShare}::numeric) >= ${config.payout.minimumThreshold}`);

      const eligible: string[] = [];
      for (const row of rows) {
        const stripeAccount = await stripeRepo.get(row.creatorId);
        if (stripeAccount?.onboardingComplete && stripeAccount.stripeAccountId) {
          eligible.push(row.creatorId);
        }
      }

      log.info({ count: eligible.length }, 'Found eligible creators for payout');
      return eligible;
    },
  };
}

export type PayoutTrigger = ReturnType<typeof createPayoutTrigger>;
