import { Router } from 'express';
import type { CreatorStripeRepository, PayoutHistoryRepository } from '@sloppy/db';
import { createLogger } from '@sloppy/logger';
import {
  createConnectAccount,
  createAccountLink,
  getAccountStatus,
} from '../stripe/connect.js';
import type { PayoutCalculator } from '../revenue/calculator.js';
import type { PayoutTrigger } from '../revenue/payout-trigger.js';
import { requireUser } from '../middleware/user.js';

const log = createLogger('payments:payout');

export function payoutRouter(
  stripeRepo: CreatorStripeRepository,
  calculator: PayoutCalculator,
  payoutTrigger: PayoutTrigger,
  payoutHistoryRepo: PayoutHistoryRepository,
) {
  const router = Router();

  /**
   * POST /payments/connect-stripe
   * Initiates Stripe Connect onboarding. Creates or retrieves the Express
   * account and returns the onboarding URL.
   */
  router.post('/payments/connect-stripe', requireUser, async (req, res) => {
    try {
      const creatorId = req.userId!;
      const email = req.userEmail ?? '';
      const { refreshUrl, returnUrl } = req.body as {
        refreshUrl?: string;
        returnUrl?: string;
      };

      let existing = await stripeRepo.get(creatorId);

      if (existing?.onboardingComplete) {
        const link = await createAccountLink(
          existing.stripeAccountId!,
          refreshUrl || `${req.headers.origin}/dashboard/settings?stripe=refresh`,
          returnUrl || `${req.headers.origin}/dashboard/settings?stripe=complete`,
        );
        res.json({ data: { onboardingUrl: link.url, alreadyComplete: true } });
        return;
      }

      if (!existing?.stripeAccountId) {
        const account = await createConnectAccount(creatorId, email);
        existing = await stripeRepo.upsert(creatorId, account.id);
      }

      const link = await createAccountLink(
        existing.stripeAccountId!,
        refreshUrl || `${req.headers.origin}/dashboard/settings?stripe=refresh`,
        returnUrl || `${req.headers.origin}/dashboard/settings?stripe=complete`,
      );

      res.json({ data: { onboardingUrl: link.url } });
    } catch (err) {
      log.error({ error: (err as Error).message }, 'Failed to initiate Stripe Connect');
      res.status(500).json({
        error: 'InternalError',
        message: 'Failed to initiate Stripe Connect onboarding',
        statusCode: 500,
      });
    }
  });

  /**
   * GET /payments/connect-status
   * Returns the creator's Stripe Connect account status.
   * Response shape matches frontend ConnectStatus type.
   */
  router.get('/payments/connect-status', requireUser, async (req, res) => {
    try {
      const creatorId = req.userId!;
      const record = await stripeRepo.get(creatorId);

      if (!record?.stripeAccountId) {
        res.json({
          data: {
            hasAccount: false,
            onboardingComplete: false,
            payoutBalance: 0,
            totalPaidOut: 0,
          },
        });
        return;
      }

      const status = await getAccountStatus(record.stripeAccountId);

      if (status.detailsSubmitted && !record.onboardingComplete) {
        await stripeRepo.markOnboardingComplete(creatorId);
      }

      res.json({
        data: {
          hasAccount: true,
          onboardingComplete: status.detailsSubmitted,
          payoutBalance: parseFloat(record.payoutBalance),
          totalPaidOut: parseFloat(record.totalPaidOut),
        },
      });
    } catch (err) {
      log.error({ error: (err as Error).message }, 'Failed to check Connect status');
      res.status(500).json({
        error: 'InternalError',
        message: 'Failed to check Stripe Connect status',
        statusCode: 500,
      });
    }
  });

  /**
   * POST /payments/request-payout
   * Initiates a payout transfer. Requires balance >= threshold and a
   * completed Stripe Connect account.
   */
  router.post('/payments/request-payout', requireUser, async (req, res) => {
    try {
      const creatorId = req.userId!;
      const result = await payoutTrigger.requestPayout(creatorId);

      if (!result.success) {
        res.status(400).json({
          error: 'PayoutFailed',
          message: result.error,
          statusCode: 400,
        });
        return;
      }

      res.json({
        data: {
          transferId: result.transferId,
          amount: result.amount,
        },
      });
    } catch (err) {
      log.error({ error: (err as Error).message }, 'Failed to process payout');
      res.status(500).json({
        error: 'InternalError',
        message: 'Failed to process payout request',
        statusCode: 500,
      });
    }
  });

  /**
   * GET /payments/balance
   * Returns the creator's current payout balance, total earned, and total
   * paid out. Matches frontend paymentsApi.getBalance() shape.
   */
  router.get('/payments/balance', requireUser, async (req, res) => {
    try {
      const creatorId = req.userId!;
      const eligibility = await calculator.canRequestPayout(creatorId);
      const stripeAccount = await stripeRepo.get(creatorId);
      const totalPaidOut = parseFloat(stripeAccount?.totalPaidOut ?? '0');
      const totalEarned = eligibility.balance + totalPaidOut;

      res.json({
        data: {
          balance: eligibility.balance,
          totalEarned,
          totalPaidOut,
          eligible: eligibility.eligible,
          reason: eligibility.reason ?? null,
        },
      });
    } catch (err) {
      log.error({ error: (err as Error).message }, 'Failed to fetch balance');
      res.status(500).json({
        error: 'InternalError',
        message: 'Failed to fetch payout balance',
        statusCode: 500,
      });
    }
  });

  /**
   * GET /payments/payouts
   * Returns the creator's payout history.
   */
  router.get('/payments/payouts', requireUser, async (req, res) => {
    try {
      const creatorId = req.userId!;
      const history = await payoutHistoryRepo.getByCreator(creatorId);

      res.json({
        data: history.map((p) => ({
          id: p.id,
          amount: parseFloat(p.amount),
          status: p.status,
          createdAt: p.createdAt.toISOString(),
        })),
      });
    } catch (err) {
      log.error({ error: (err as Error).message }, 'Failed to fetch payout history');
      res.status(500).json({
        error: 'InternalError',
        message: 'Failed to fetch payout history',
        statusCode: 500,
      });
    }
  });

  return router;
}
