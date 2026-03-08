import {
  pgTable,
  text,
  boolean,
  integer,
  timestamp,
  index,
  uniqueIndex,
  primaryKey,
  real,
  bigint,
  jsonb,
  numeric,
} from 'drizzle-orm/pg-core';

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  firebaseUid: text('firebase_uid').notNull().unique(),
  email: text('email').notNull(),
  displayName: text('display_name'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ---------------------------------------------------------------------------
// Games
// ---------------------------------------------------------------------------

export const games = pgTable(
  'games',
  {
    id: text('id').primaryKey(),
    creatorId: text('creator_id')
      .notNull()
      .references(() => users.id),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    slug: text('slug').notNull().unique(),
    genre: text('genre'),
    engine: text('engine').notNull().default('canvas2d'),
    thumbnailUrl: text('thumbnail_url'),
    thumbnailSmUrl: text('thumbnail_sm_url'),
    resolutionWidth: integer('resolution_width').notNull().default(960),
    resolutionHeight: integer('resolution_height').notNull().default(540),
    scaleMode: text('scale_mode').notNull().default('fit'),
    supportsMultiplayer: boolean('supports_multiplayer')
      .notNull()
      .default(false),
    version: integer('version').notNull().default(1),
    status: text('status', { enum: ['draft', 'published'] })
      .notNull()
      .default('draft'),
    playCount: integer('play_count').notNull().default(0),
    favouriteCount: integer('favourite_count').notNull().default(0),
    storagePath: text('storage_path'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('games_slug_idx').on(table.slug),
    index('games_creator_id_idx').on(table.creatorId),
    index('games_status_created_at_idx').on(table.status, table.createdAt),
    index('games_genre_idx').on(table.genre),
    index('games_engine_idx').on(table.engine),
  ],
);

// ---------------------------------------------------------------------------
// Game Versions (version history for rollback + depth enforcement)
// ---------------------------------------------------------------------------

export const gameVersions = pgTable(
  'game_versions',
  {
    id: text('id').primaryKey(),
    gameId: text('game_id')
      .notNull()
      .references(() => games.id),
    version: integer('version').notNull(),
    storagePath: text('storage_path'),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('game_versions_game_id_idx').on(table.gameId),
    uniqueIndex('game_versions_game_id_version_idx').on(
      table.gameId,
      table.version,
    ),
  ],
);

// ---------------------------------------------------------------------------
// Favourites
// ---------------------------------------------------------------------------

export const favourites = pgTable(
  'favourites',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    gameId: text('game_id')
      .notNull()
      .references(() => games.id),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.gameId] }),
    index('favourites_user_id_idx').on(table.userId),
  ],
);

// ---------------------------------------------------------------------------
// Generation Logs (AI cost tracking)
// ---------------------------------------------------------------------------

export const generationLogs = pgTable(
  'generation_logs',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    gameId: text('game_id').references(() => games.id),
    model: text('model').notNull(),
    phase: text('phase').notNull(),
    promptTokens: integer('prompt_tokens').notNull().default(0),
    completionTokens: integer('completion_tokens').notNull().default(0),
    totalCost: real('total_cost').notNull().default(0),
    durationMs: bigint('duration_ms', { mode: 'number' }).notNull().default(0),
    status: text('status', { enum: ['success', 'error', 'timeout'] })
      .notNull()
      .default('success'),
    error: text('error'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('generation_logs_user_id_idx').on(table.userId),
    index('generation_logs_created_at_idx').on(table.createdAt),
    index('generation_logs_model_idx').on(table.model),
  ],
);

// ---------------------------------------------------------------------------
// Game Crash Logs
// ---------------------------------------------------------------------------

export const gameCrashLogs = pgTable(
  'game_crash_logs',
  {
    id: text('id').primaryKey(),
    gameId: text('game_id')
      .notNull()
      .references(() => games.id),
    userId: text('user_id').references(() => users.id),
    errorMessage: text('error_message').notNull(),
    stackTrace: text('stack_trace'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('game_crash_logs_game_id_idx').on(table.gameId),
    index('game_crash_logs_created_at_idx').on(table.createdAt),
  ],
);

// ---------------------------------------------------------------------------
// Multiplayer Sessions
// ---------------------------------------------------------------------------

export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    gameId: text('game_id')
      .notNull()
      .references(() => games.id),
    hostId: text('host_id')
      .notNull()
      .references(() => users.id),
    status: text('status', { enum: ['waiting', 'active', 'closed'] })
      .notNull()
      .default('waiting'),
    playerCount: integer('player_count').notNull().default(0),
    maxPlayers: integer('max_players').notNull().default(4),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    closedAt: timestamp('closed_at', { withTimezone: true }),
  },
  (table) => [
    index('sessions_game_id_status_idx').on(table.gameId, table.status),
  ],
);

// ---------------------------------------------------------------------------
// Game Progress (per-user save data)
// ---------------------------------------------------------------------------

export const gameProgress = pgTable(
  'game_progress',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    gameId: text('game_id')
      .notNull()
      .references(() => games.id),
    progressData: jsonb('progress_data'),
    playTimeMs: integer('play_time_ms').notNull().default(0),
    lastPlayed: timestamp('last_played', { withTimezone: true })
      .notNull()
      .defaultNow(),
    playCount: integer('play_count').notNull().default(0),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.gameId] }),
  ],
);

// ---------------------------------------------------------------------------
// Creator Earnings (monthly ad revenue per creator per game)
// ---------------------------------------------------------------------------

export const creatorEarnings = pgTable(
  'creator_earnings',
  {
    id: text('id').primaryKey(),
    creatorId: text('creator_id')
      .notNull()
      .references(() => users.id),
    gameId: text('game_id').references(() => games.id),
    periodMonth: timestamp('period_month', { withTimezone: true }).notNull(),
    grossRevenue: numeric('gross_revenue', { precision: 10, scale: 2 })
      .notNull()
      .default('0'),
    creatorShare: numeric('creator_share', { precision: 10, scale: 2 })
      .notNull()
      .default('0'),
    platformShare: numeric('platform_share', { precision: 10, scale: 2 })
      .notNull()
      .default('0'),
    status: text('status', {
      enum: ['pending', 'confirmed', 'paid'],
    })
      .notNull()
      .default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('creator_earnings_creator_id_idx').on(table.creatorId),
    index('creator_earnings_period_idx').on(table.creatorId, table.periodMonth),
  ],
);

// ---------------------------------------------------------------------------
// Creator Stripe Accounts (Stripe Connect)
// ---------------------------------------------------------------------------

export const creatorStripeAccounts = pgTable('creator_stripe_accounts', {
  creatorId: text('creator_id')
    .primaryKey()
    .references(() => users.id),
  stripeAccountId: text('stripe_account_id').unique(),
  onboardingComplete: boolean('onboarding_complete').notNull().default(false),
  payoutBalance: numeric('payout_balance', { precision: 10, scale: 2 })
    .notNull()
    .default('0'),
  totalPaidOut: numeric('total_paid_out', { precision: 10, scale: 2 })
    .notNull()
    .default('0'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ---------------------------------------------------------------------------
// Creator Subscriptions (Stripe Billing)
// ---------------------------------------------------------------------------

export const creatorSubscriptions = pgTable('creator_subscriptions', {
  creatorId: text('creator_id')
    .primaryKey()
    .references(() => users.id),
  stripeCustomerId: text('stripe_customer_id'),
  stripeSubId: text('stripe_sub_id'),
  status: text('status', {
    enum: ['active', 'past_due', 'canceled'],
  }),
  currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ---------------------------------------------------------------------------
// Feed Events (analytics for ranking algorithm)
// ---------------------------------------------------------------------------

export const feedEvents = pgTable(
  'feed_events',
  {
    id: text('id').primaryKey(),
    userId: text('user_id'),
    gameId: text('game_id')
      .notNull()
      .references(() => games.id),
    eventType: text('event_type', {
      enum: ['view', 'play_start', 'play_time', 'skip', 'favourite'],
    }).notNull(),
    durationMs: integer('duration_ms'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('feed_events_game_id_idx').on(table.gameId),
    index('feed_events_created_at_idx').on(table.createdAt),
    index('feed_events_event_type_idx').on(table.eventType),
  ],
);

// ---------------------------------------------------------------------------
// Payout History (records of completed Stripe transfers)
// ---------------------------------------------------------------------------

export const payoutHistory = pgTable(
  'payout_history',
  {
    id: text('id').primaryKey(),
    creatorId: text('creator_id')
      .notNull()
      .references(() => users.id),
    stripeTransferId: text('stripe_transfer_id').notNull(),
    amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
    currency: text('currency').notNull().default('usd'),
    status: text('status', {
      enum: ['processing', 'completed', 'failed'],
    })
      .notNull()
      .default('processing'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('payout_history_creator_id_idx').on(table.creatorId),
    index('payout_history_created_at_idx').on(table.createdAt),
  ],
);

// ---------------------------------------------------------------------------
// Ad Impressions (revenue tracking per impression)
// ---------------------------------------------------------------------------

export const adImpressions = pgTable(
  'ad_impressions',
  {
    id: text('id').primaryKey(),
    adProvider: text('ad_provider').notNull(),
    format: text('format').notNull(),
    gameId: text('game_id').references(() => games.id),
    creatorId: text('creator_id').references(() => users.id),
    estimatedRevenue: numeric('estimated_revenue', { precision: 10, scale: 4 })
      .notNull()
      .default('0'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('ad_impressions_game_id_idx').on(table.gameId),
    index('ad_impressions_created_at_idx').on(table.createdAt),
  ],
);
