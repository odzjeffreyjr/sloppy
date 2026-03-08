// Schema
export * from './schema.js';

// Re-export drizzle operators so consumers use the same drizzle-orm instance
export { eq, and, or, not, sql, desc, asc, gt, gte, lt, lte, ne, isNull, isNotNull, inArray, like, ilike, between, exists, notExists } from 'drizzle-orm';

// Connection
export { createDatabase, createMigrationClient, type Database } from './connection.js';

// Cursor pagination
export { encodeCursor, decodeCursor, type CursorPage } from './cursor.js';

// Mappers
export { mapUser, mapGame, mapFavourite, mapSession } from './mappers.js';

// Repositories
export {
  createUserRepository,
  createGameRepository,
  createFavouriteRepository,
  createSessionRepository,
  createGenerationLogRepository,
  createGameCrashRepository,
  createGameProgressRepository,
  createCreatorEarningsRepository,
  createCreatorStripeRepository,
  createCreatorSubscriptionRepository,
  createFeedEventRepository,
  createPayoutHistoryRepository,
  type UserRepository,
  type GameRepository,
  type FavouriteRepository,
  type SessionRepository,
  type GenerationLogRepository,
  type GameCrashRepository,
  type GameProgressRepository,
  type CreatorEarningsRepository,
  type CreatorStripeRepository,
  type CreatorSubscriptionRepository,
  type FeedEventRepository,
  type CreateGenerationLog,
  type CreateGameCrashLog,
  type FeedSort,
  type GameSearchFilters,
  type GameProgressRecord,
  type CreatorEarningsRecord,
  type CreatorStripeRecord,
  type CreatorSubscriptionRecord,
  type FeedEventRecord,
  type FeedEventType,
  type PayoutHistoryRepository,
  type PayoutHistoryRecord,
  createGameVersionRepository,
  type GameVersionRepository,
  type GameVersionRecord,
} from './repositories/index.js';
