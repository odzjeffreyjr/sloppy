import express from 'express';
import {
  createDatabase,
  createUserRepository,
  createCreatorSubscriptionRepository,
  createCreatorEarningsRepository,
  createCreatorStripeRepository,
  createPayoutHistoryRepository,
} from '@sloppy/db';
import { createLogger, requestLoggerMiddleware, sentryErrorMiddleware, initSentry } from '@sloppy/logger';
import { config } from './config.js';
import { resolveUser } from './middleware/user.js';
import { subscriptionRouter } from './routes/subscription.js';
import { earningsRouter } from './routes/earnings.js';
import { payoutRouter } from './routes/payout.js';
import { createWebhookHandler } from './stripe/webhooks.js';
import { createAdTracker } from './revenue/tracker.js';
import { createRevenueAttribution } from './revenue/attribution.js';
import { createPayoutCalculator } from './revenue/calculator.js';
import { createPayoutTrigger } from './revenue/payout-trigger.js';

const log = createLogger('payments');
const startedAt = Date.now();

initSentry(process.env.SENTRY_DSN, 'payments');

const app = express();

const db = createDatabase();
const userRepo = createUserRepository(db);
const subRepo = createCreatorSubscriptionRepository(db);
const earningsRepo = createCreatorEarningsRepository(db);
const stripeRepo = createCreatorStripeRepository(db);
const payoutHistoryRepo = createPayoutHistoryRepository(db);
const adTracker = createAdTracker(db);
const revenueAttribution = createRevenueAttribution(db);
const payoutCalculator = createPayoutCalculator(earningsRepo, stripeRepo);
const payoutTriggerInstance = createPayoutTrigger(db, stripeRepo, payoutCalculator, payoutHistoryRepo);

// Stripe webhooks need raw body — mount BEFORE json parsing
app.post(
  '/payments/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  createWebhookHandler(subRepo, stripeRepo),
);

app.use(express.json({ limit: '1mb' }));
app.use(requestLoggerMiddleware(log));
app.use(resolveUser(userRepo));

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'payments',
    version: process.env.npm_package_version ?? '0.0.0',
    uptime: Math.floor((Date.now() - startedAt) / 1000),
    dependencies: { db: 'connected' },
  });
});

app.use(subscriptionRouter(subRepo));
app.use(earningsRouter(adTracker, revenueAttribution, earningsRepo));
app.use(payoutRouter(stripeRepo, payoutCalculator, payoutTriggerInstance, payoutHistoryRepo));

app.use(sentryErrorMiddleware);

app.listen(config.port, () => {
  log.info({ port: config.port }, 'payments listening');
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    log.info({ signal }, 'Shutting down');
    process.exit(0);
  });
}

export default app;
