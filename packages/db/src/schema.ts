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
    supportsMultiplayer: boolean('supports_multiplayer')
      .notNull()
      .default(false),
    version: integer('version').notNull().default(1),
    status: text('status', { enum: ['draft', 'published'] })
      .notNull()
      .default('draft'),
    playCount: integer('play_count').notNull().default(0),
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
