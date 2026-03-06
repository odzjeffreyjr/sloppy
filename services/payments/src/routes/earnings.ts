import { Router } from 'express';
import { createLogger } from '@sloppy/logger';
import type { AdTracker } from '../revenue/tracker.js';
import type { RevenueAttribution } from '../revenue/attribution.js';
import type { CreatorEarningsRepository } from '@sloppy/db';
import { requireUser } from '../middleware/user.js';

const log = createLogger('payments:earnings');

export function earningsRouter(
  tracker: AdTracker,
  attribution: RevenueAttribution,
  earningsRepo: CreatorEarningsRepository,
) {
  const router = Router();

  /**
   * POST /payments/ad-impression
   * Records an ad impression. Called by the frontend or ad SDK callback.
   */
  router.post('/payments/ad-impression', async (req, res) => {
    try {
      const { adProvider, format, gameId, creatorId } = req.body as {
        adProvider: string;
        format: string;
        gameId?: string;
        creatorId?: string;
      };

      if (!adProvider || !format) {
        res.status(400).json({
          error: 'BadRequest',
          message: 'adProvider and format are required',
          statusCode: 400,
        });
        return;
      }

      const result = await tracker.trackImpression({
        adProvider: adProvider as any,
        format: format as any,
        gameId,
        creatorId,
      });

      res.json({ data: result });
    } catch (err) {
      log.error({ error: (err as Error).message }, 'Failed to track ad impression');
      res.status(500).json({
        error: 'InternalError',
        message: 'Failed to track ad impression',
        statusCode: 500,
      });
    }
  });

  /**
   * GET /payments/earnings?creatorId=X&month=YYYY-MM
   * Returns creator's earnings summary. If month is provided, scoped to that month.
   */
  router.get('/payments/earnings', requireUser, async (req, res) => {
    try {
      const creatorId = (req.query.creatorId as string) || req.userId!;
      const monthStr = req.query.month as string | undefined;

      if (monthStr) {
        const month = new Date(monthStr + '-01');
        const revenue = await attribution.getCreatorRevenue(creatorId, month);
        res.json({ data: revenue });
        return;
      }

      const allEarnings = await earningsRepo.getByCreator(creatorId);
      const totalBalance = await earningsRepo.getTotalBalance(creatorId);

      res.json({
        data: {
          earnings: allEarnings,
          totalBalance,
        },
      });
    } catch (err) {
      log.error({ error: (err as Error).message }, 'Failed to fetch earnings');
      res.status(500).json({
        error: 'InternalError',
        message: 'Failed to fetch earnings',
        statusCode: 500,
      });
    }
  });

  /**
   * POST /payments/reconcile
   * Admin endpoint: reconciles estimated ad revenue with actual figures
   * for a given month. Creates/updates creator_earnings records.
   * Body: { month: "YYYY-MM" } — defaults to previous month.
   */
  router.post('/payments/reconcile', requireUser, async (req, res) => {
    try {
      const { month: monthStr } = req.body as { month?: string };

      let month: Date;
      if (monthStr) {
        month = new Date(monthStr + '-01');
      } else {
        const now = new Date();
        month = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      }

      const result = await attribution.reconcileMonthlyRevenue(month);

      log.info(
        { month: month.toISOString(), processed: result.processed },
        'Reconciliation triggered',
      );

      res.json({
        data: {
          month: month.toISOString(),
          processed: result.processed,
        },
      });
    } catch (err) {
      log.error({ error: (err as Error).message }, 'Reconciliation failed');
      res.status(500).json({
        error: 'InternalError',
        message: 'Reconciliation failed',
        statusCode: 500,
      });
    }
  });

  return router;
}
