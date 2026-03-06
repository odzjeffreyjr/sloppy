import type { Request, Response } from 'express';
import type Stripe from 'stripe';
import type { CreatorSubscriptionRepository, CreatorStripeRepository } from '@sloppy/db';
import { createLogger } from '@sloppy/logger';
import { stripe } from './billing.js';
import { config } from '../config.js';

const log = createLogger('payments:webhooks');

export function createWebhookHandler(
  subRepo: CreatorSubscriptionRepository,
  stripeRepo?: CreatorStripeRepository,
) {
  return async (req: Request, res: Response): Promise<void> => {
    const sig = req.headers['stripe-signature'];
    if (!sig) {
      res.status(400).json({ error: 'Missing stripe-signature header' });
      return;
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body as Buffer,
        sig,
        config.stripe.webhookSecret,
      );
    } catch (err) {
      log.error({ error: (err as Error).message }, 'Webhook signature verification failed');
      res.status(400).json({ error: 'Invalid signature' });
      return;
    }

    log.info({ type: event.type, id: event.id }, 'Stripe webhook received');

    try {
      switch (event.type) {
        case 'invoice.paid': {
          const invoice = event.data.object as Stripe.Invoice;
          const sub = await stripe.subscriptions.retrieve(
            invoice.subscription as string,
          );
          const creatorId = sub.metadata.userId ?? invoice.metadata?.userId;
          if (creatorId) {
            await subRepo.upsert({
              creatorId,
              stripeCustomerId: invoice.customer as string,
              stripeSubId: sub.id,
              status: 'active',
              currentPeriodEnd: new Date(sub.current_period_end * 1000),
            });
            log.info({ creatorId }, 'Subscription activated via invoice.paid');
          }
          break;
        }

        case 'invoice.payment_failed': {
          const invoice = event.data.object as Stripe.Invoice;
          const sub = await stripe.subscriptions.retrieve(
            invoice.subscription as string,
          );
          const creatorId = sub.metadata.userId ?? invoice.metadata?.userId;
          if (creatorId) {
            await subRepo.upsert({
              creatorId,
              stripeCustomerId: invoice.customer as string,
              stripeSubId: sub.id,
              status: 'past_due',
              currentPeriodEnd: new Date(sub.current_period_end * 1000),
            });
            log.warn({ creatorId }, 'Payment failed — subscription past_due');
          }
          break;
        }

        case 'customer.subscription.updated': {
          const sub = event.data.object as Stripe.Subscription;
          const creatorId = sub.metadata.userId;
          if (creatorId) {
            const status =
              sub.status === 'active'
                ? 'active'
                : sub.status === 'past_due'
                  ? 'past_due'
                  : 'canceled';
            await subRepo.upsert({
              creatorId,
              stripeCustomerId: sub.customer as string,
              stripeSubId: sub.id,
              status,
              currentPeriodEnd: new Date(sub.current_period_end * 1000),
            });
            log.info({ creatorId, status }, 'Subscription updated');
          }
          break;
        }

        case 'customer.subscription.deleted': {
          const sub = event.data.object as Stripe.Subscription;
          const creatorId = sub.metadata.userId;
          if (creatorId) {
            await subRepo.upsert({
              creatorId,
              stripeCustomerId: sub.customer as string,
              stripeSubId: sub.id,
              status: 'canceled',
              currentPeriodEnd: new Date(sub.current_period_end * 1000),
            });
            log.info({ creatorId }, 'Subscription canceled');
          }
          break;
        }

        // --- Stripe Connect events ---

        case 'account.updated': {
          if (!stripeRepo) break;
          const account = event.data.object as Stripe.Account;
          const creatorId = account.metadata?.creatorId;
          if (creatorId && account.details_submitted) {
            await stripeRepo.markOnboardingComplete(creatorId);
            log.info({ creatorId, accountId: account.id }, 'Connect onboarding complete via webhook');
          }
          break;
        }

        case 'transfer.created': {
          const transfer = event.data.object as Stripe.Transfer;
          const creatorId = transfer.metadata?.creatorId;
          log.info(
            { creatorId, transferId: transfer.id, amount: transfer.amount / 100 },
            'Transfer created successfully',
          );
          break;
        }

        case 'transfer.reversed': {
          const transfer = event.data.object as Stripe.Transfer;
          const creatorId = transfer.metadata?.creatorId;
          log.error(
            { creatorId, transferId: transfer.id, amount: transfer.amount / 100 },
            'Transfer reversed — manual intervention may be required',
          );
          break;
        }

        default:
          log.debug({ type: event.type }, 'Unhandled event type');
      }

      res.json({ received: true });
    } catch (err) {
      log.error({ error: (err as Error).message, type: event.type }, 'Webhook processing error');
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  };
}
