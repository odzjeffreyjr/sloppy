-- v2 schema migration
-- Safe to run on databases with existing data (all new columns have defaults or are nullable)

-- ---------------------------------------------------------------------------
-- Extend games table
-- ---------------------------------------------------------------------------

ALTER TABLE games ADD COLUMN IF NOT EXISTS genre TEXT;
ALTER TABLE games ADD COLUMN IF NOT EXISTS engine TEXT NOT NULL DEFAULT 'canvas2d';
ALTER TABLE games ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
ALTER TABLE games ADD COLUMN IF NOT EXISTS thumbnail_sm_url TEXT;
ALTER TABLE games ADD COLUMN IF NOT EXISTS resolution_width INTEGER NOT NULL DEFAULT 960;
ALTER TABLE games ADD COLUMN IF NOT EXISTS resolution_height INTEGER NOT NULL DEFAULT 540;
ALTER TABLE games ADD COLUMN IF NOT EXISTS scale_mode TEXT NOT NULL DEFAULT 'fit';
ALTER TABLE games ADD COLUMN IF NOT EXISTS favourite_count INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS games_genre_idx ON games (genre);
CREATE INDEX IF NOT EXISTS games_engine_idx ON games (engine);

-- ---------------------------------------------------------------------------
-- Game Progress (per-user save data)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS game_progress (
  user_id     TEXT NOT NULL REFERENCES users(id),
  game_id     TEXT NOT NULL REFERENCES games(id),
  progress_data JSONB,
  play_time_ms  INTEGER NOT NULL DEFAULT 0,
  last_played   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  play_count    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, game_id)
);

-- ---------------------------------------------------------------------------
-- Creator Earnings (monthly ad revenue per creator per game)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS creator_earnings (
  id              TEXT PRIMARY KEY,
  creator_id      TEXT NOT NULL REFERENCES users(id),
  game_id         TEXT REFERENCES games(id),
  period_month    TIMESTAMPTZ NOT NULL,
  gross_revenue   NUMERIC(10,2) NOT NULL DEFAULT 0,
  creator_share   NUMERIC(10,2) NOT NULL DEFAULT 0,
  platform_share  NUMERIC(10,2) NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'pending',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS creator_earnings_creator_id_idx ON creator_earnings (creator_id);
CREATE INDEX IF NOT EXISTS creator_earnings_period_idx ON creator_earnings (creator_id, period_month);

-- ---------------------------------------------------------------------------
-- Creator Stripe Accounts (Stripe Connect)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS creator_stripe_accounts (
  creator_id          TEXT PRIMARY KEY REFERENCES users(id),
  stripe_account_id   TEXT UNIQUE,
  onboarding_complete BOOLEAN NOT NULL DEFAULT FALSE,
  payout_balance      NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_paid_out      NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Creator Subscriptions (Stripe Billing)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS creator_subscriptions (
  creator_id          TEXT PRIMARY KEY REFERENCES users(id),
  stripe_customer_id  TEXT,
  stripe_sub_id       TEXT,
  status              TEXT,
  current_period_end  TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Feed Events (analytics for ranking algorithm)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS feed_events (
  id          TEXT PRIMARY KEY,
  user_id     TEXT,
  game_id     TEXT NOT NULL REFERENCES games(id),
  event_type  TEXT NOT NULL,
  duration_ms INTEGER,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS feed_events_game_id_idx ON feed_events (game_id);
CREATE INDEX IF NOT EXISTS feed_events_created_at_idx ON feed_events (created_at);
CREATE INDEX IF NOT EXISTS feed_events_event_type_idx ON feed_events (event_type);

-- ---------------------------------------------------------------------------
-- Ad Impressions (revenue tracking per impression)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ad_impressions (
  id                TEXT PRIMARY KEY,
  ad_provider       TEXT NOT NULL,
  format            TEXT NOT NULL,
  game_id           TEXT REFERENCES games(id),
  creator_id        TEXT REFERENCES users(id),
  estimated_revenue NUMERIC(10,4) NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ad_impressions_game_id_idx ON ad_impressions (game_id);
CREATE INDEX IF NOT EXISTS ad_impressions_created_at_idx ON ad_impressions (created_at);
