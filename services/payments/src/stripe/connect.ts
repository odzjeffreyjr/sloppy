import type Stripe from 'stripe';
import { stripe } from './billing.js';
import { createLogger } from '@sloppy/logger';

const log = createLogger('payments:connect');

export async function createConnectAccount(
  creatorId: string,
  email: string,
): Promise<Stripe.Account> {
  const account = await stripe.accounts.create({
    type: 'express',
    email,
    metadata: { creatorId },
    capabilities: {
      transfers: { requested: true },
    },
  });
  log.info({ creatorId, accountId: account.id }, 'Connect account created');
  return account;
}

export async function createAccountLink(
  accountId: string,
  refreshUrl: string,
  returnUrl: string,
): Promise<Stripe.AccountLink> {
  return stripe.accountLinks.create({
    account: accountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: 'account_onboarding',
  });
}

export async function getAccountStatus(
  accountId: string,
): Promise<{ detailsSubmitted: boolean; payoutsEnabled: boolean; chargesEnabled: boolean }> {
  const account = await stripe.accounts.retrieve(accountId);
  return {
    detailsSubmitted: account.details_submitted ?? false,
    payoutsEnabled: account.payouts_enabled ?? false,
    chargesEnabled: account.charges_enabled ?? false,
  };
}

export async function createTransfer(
  amount: number,
  currency: string,
  destinationAccountId: string,
  metadata: Record<string, string>,
): Promise<Stripe.Transfer> {
  const transfer = await stripe.transfers.create({
    amount: Math.round(amount * 100),
    currency,
    destination: destinationAccountId,
    metadata,
  });
  log.info(
    { transferId: transfer.id, amount, destination: destinationAccountId },
    'Transfer created',
  );
  return transfer;
}

export async function getAccountBalance(
  accountId: string,
): Promise<{ available: number; pending: number }> {
  const balance = await stripe.balance.retrieve({
    stripeAccount: accountId,
  });

  const available = balance.available.reduce(
    (sum, b) => sum + b.amount,
    0,
  ) / 100;
  const pending = balance.pending.reduce(
    (sum, b) => sum + b.amount,
    0,
  ) / 100;

  return { available, pending };
}
