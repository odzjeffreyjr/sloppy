export const config = {
  port: parseInt(process.env.PORT || '3006', 10),

  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || '',
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    priceId: process.env.STRIPE_PRICE_ID || '',
    connectSecret: process.env.STRIPE_CONNECT_SECRET || '',
  },

  payout: {
    minimumThreshold: parseFloat(process.env.PAYOUT_MINIMUM_THRESHOLD || '60'),
    currency: 'usd',
  },

  databaseUrl: process.env.DATABASE_URL || 'postgresql://sloppy:sloppy_dev@localhost:5432/sloppy',
};
