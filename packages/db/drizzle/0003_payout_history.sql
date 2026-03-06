-- Payout history table for tracking completed Stripe transfers
CREATE TABLE IF NOT EXISTS "payout_history" (
  "id" text PRIMARY KEY NOT NULL,
  "creator_id" text NOT NULL REFERENCES "users"("id"),
  "stripe_transfer_id" text NOT NULL,
  "amount" numeric(10,2) NOT NULL,
  "currency" text NOT NULL DEFAULT 'usd',
  "status" text NOT NULL DEFAULT 'processing',
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "payout_history_creator_id_idx" ON "payout_history" ("creator_id");
CREATE INDEX IF NOT EXISTS "payout_history_created_at_idx" ON "payout_history" ("created_at");
