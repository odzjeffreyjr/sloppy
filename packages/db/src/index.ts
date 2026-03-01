// Schema
export * from './schema.js';

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
  type UserRepository,
  type GameRepository,
  type FavouriteRepository,
  type SessionRepository,
  type GenerationLogRepository,
  type GameCrashRepository,
  type CreateGenerationLog,
  type CreateGameCrashLog,
  type FeedSort,
} from './repositories/index.js';
