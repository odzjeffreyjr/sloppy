import type { CreatorEarningsRepository, CreatorStripeRepository } from '@sloppy/db';
import { createLogger } from '@sloppy/logger';
import { config } from '../config.js';

const log = createLogger('payments:calculator');

export function createPayoutCalculator(
  earningsRepo: CreatorEarningsRepository,
  stripeRepo: CreatorStripeRepository,
) {
  return {
    async calculateCreatorBalance(creatorId: string): Promise<number> {
      return earningsRepo.getTotalBalance(creatorId);
    },

    async canRequestPayout(
      creatorId: string,
    ): Promise<{ eligible: boolean; reason?: string; balance: number }> {
      const balance = await earningsRepo.getTotalBalance(creatorId);

      if (balance < config.payout.minimumThreshold) {
        return {
          eligible: false,
          reason: `Balance ($${balance.toFixed(2)}) is below minimum threshold ($${config.payout.minimumThreshold})`,
          balance,
        };
      }

      const stripeAccount = await stripeRepo.get(creatorId);
      if (!stripeAccount) {
        return {
          eligible: false,
          reason: 'No Stripe Connect account linked',
          balance,
        };
      }

      if (!stripeAccount.onboardingComplete) {
        return {
          eligible: false,
          reason: 'Stripe Connect onboarding not complete',
          balance,
        };
      }

      if (!stripeAccount.stripeAccountId) {
        return {
          eligible: false,
          reason: 'No Stripe account ID found',
          balance,
        };
      }

      log.debug({ creatorId, balance }, 'Creator eligible for payout');
      return { eligible: true, balance };
    },
  };
}

export type PayoutCalculator = ReturnType<typeof createPayoutCalculator>;
