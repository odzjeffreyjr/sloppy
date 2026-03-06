import { Router } from 'express';
import type { CreatorSubscriptionRepository } from '@sloppy/db';
import { createLogger } from '@sloppy/logger';
import {
  createCustomer,
  createCheckoutSession,
  cancelSubscription,
  createBillingPortalSession,
} from '../stripe/billing.js';
import { config } from '../config.js';
import { requireUser } from '../middleware/user.js';

const log = createLogger('payments:subscription');

export function subscriptionRouter(subRepo: CreatorSubscriptionRepository) {
  const router = Router();

  router.post('/payments/subscribe', requireUser, async (req, res) => {
    try {
      const userId = req.userId!;
      const email = req.userEmail ?? '';
      const { successUrl, cancelUrl } = req.body as {
        successUrl?: string;
        cancelUrl?: string;
      };

      const existing = await subRepo.get(userId);

      let customerId = existing?.stripeCustomerId;
      if (!customerId) {
        const customer = await createCustomer(userId, email);
        customerId = customer.id;
      }

      const session = await createCheckoutSession(
        customerId,
        config.stripe.priceId,
        userId,
        successUrl || `${req.headers.origin}/subscription?success=true`,
        cancelUrl || `${req.headers.origin}/subscription?canceled=true`,
      );

      res.json({ data: { checkoutUrl: session.url } });
    } catch (err) {
      log.error({ error: (err as Error).message }, 'Failed to create checkout session');
      res.status(500).json({
        error: 'InternalError',
        message: 'Failed to create checkout session',
        statusCode: 500,
      });
    }
  });

  router.get('/payments/subscription', requireUser, async (req, res) => {
    try {
      const sub = await subRepo.get(req.userId!);
      if (!sub) {
        res.json({
          data: {
            status: 'none',
            isSubscribed: false,
            currentPeriodEnd: null,
          },
        });
        return;
      }

      res.json({
        data: {
          status: sub.status ?? 'none',
          isSubscribed: sub.status === 'active',
          currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
        },
      });
    } catch (err) {
      log.error({ error: (err as Error).message }, 'Failed to fetch subscription');
      res.status(500).json({
        error: 'InternalError',
        message: 'Failed to fetch subscription',
        statusCode: 500,
      });
    }
  });

  router.post('/payments/cancel', requireUser, async (req, res) => {
    try {
      const sub = await subRepo.get(req.userId!);
      if (!sub?.stripeSubId) {
        res.status(404).json({
          error: 'NotFound',
          message: 'No active subscription found',
          statusCode: 404,
        });
        return;
      }

      await cancelSubscription(sub.stripeSubId);
      res.json({ data: { canceled: true } });
    } catch (err) {
      log.error({ error: (err as Error).message }, 'Failed to cancel subscription');
      res.status(500).json({
        error: 'InternalError',
        message: 'Failed to cancel subscription',
        statusCode: 500,
      });
    }
  });

  router.post('/payments/portal', requireUser, async (req, res) => {
    try {
      const sub = await subRepo.get(req.userId!);
      if (!sub?.stripeCustomerId) {
        res.status(404).json({
          error: 'NotFound',
          message: 'No subscription found',
          statusCode: 404,
        });
        return;
      }

      const { returnUrl } = req.body as { returnUrl?: string };
      const session = await createBillingPortalSession(
        sub.stripeCustomerId,
        returnUrl || `${req.headers.origin}/subscription`,
      );

      res.json({ data: { portalUrl: session.url } });
    } catch (err) {
      log.error({ error: (err as Error).message }, 'Failed to create portal session');
      res.status(500).json({
        error: 'InternalError',
        message: 'Failed to create billing portal session',
        statusCode: 500,
      });
    }
  });

  return router;
}
