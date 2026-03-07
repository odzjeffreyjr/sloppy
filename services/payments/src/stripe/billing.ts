import Stripe from 'stripe';
import { config } from '../config.js';

export const stripe: Stripe = config.stripe.secretKey
  ? new Stripe(config.stripe.secretKey)
  : new Proxy({} as Stripe, {
      get(_, prop) {
        if (prop === 'then' || prop === Symbol.toPrimitive) return undefined;
        throw new Error(
          `Stripe is not configured (STRIPE_SECRET_KEY missing). Cannot access stripe.${String(prop)}`,
        );
      },
    });

export async function createCustomer(
  userId: string,
  email: string,
): Promise<Stripe.Customer> {
  return stripe.customers.create({
    email,
    metadata: { userId },
  });
}

export async function createSubscription(
  customerId: string,
  priceId: string,
): Promise<Stripe.Subscription> {
  return stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
    payment_behavior: 'default_incomplete',
    expand: ['latest_invoice.payment_intent'],
  });
}

export async function cancelSubscription(
  subscriptionId: string,
): Promise<Stripe.Subscription> {
  return stripe.subscriptions.cancel(subscriptionId);
}

export async function getSubscription(
  subscriptionId: string,
): Promise<Stripe.Subscription> {
  return stripe.subscriptions.retrieve(subscriptionId);
}

export async function createCheckoutSession(
  customerId: string,
  priceId: string,
  userId: string,
  successUrl: string,
  cancelUrl: string,
): Promise<Stripe.Checkout.Session> {
  return stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: { metadata: { userId } },
    success_url: successUrl,
    cancel_url: cancelUrl,
  });
}

export async function createBillingPortalSession(
  customerId: string,
  returnUrl: string,
): Promise<Stripe.BillingPortal.Session> {
  return stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
}
