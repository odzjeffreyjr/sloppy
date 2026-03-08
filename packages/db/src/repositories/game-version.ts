import { eq, asc, sql } from 'drizzle-orm';
import { generateId } from '@sloppy/shared';
import type { Database } from '../connection.js';
import { gameVersions } from '../schema.js';

export interface GameVersionRecord {
  id: string;
  gameId: string;
  version: number;
  storagePath: string | null;
  title: string;
  description: string;
  createdAt: Date;
}

function mapVersion(
  row: typeof gameVersions.$inferSelect,
): GameVersionRecord {
  return {
    id: row.id,
    gameId: row.gameId,
    version: row.version,
    storagePath: row.storagePath,
    title: row.title,
    description: row.description,
    createdAt: row.createdAt,
  };
}

export function createGameVersionRepository(db: Database) {
  return {
    async create(data: {
      gameId: string;
      version: number;
      storagePath: string | null;
      title: string;
      description: string;
    }): Promise<GameVersionRecord> {
      const [row] = await db
        .insert(gameVersions)
        .values({
          id: generateId(),
          gameId: data.gameId,
          version: data.version,
          storagePath: data.storagePath,
          title: data.title,
          description: data.description,
        })
        .returning();
      return mapVersion(row);
    },

    async findByGameId(gameId: string): Promise<GameVersionRecord[]> {
      const rows = await db
        .select()
        .from(gameVersions)
        .where(eq(gameVersions.gameId, gameId))
        .orderBy(asc(gameVersions.version));
      return rows.map(mapVersion);
    },

    async countByGameId(gameId: string): Promise<number> {
      const [result] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(gameVersions)
        .where(eq(gameVersions.gameId, gameId));
      return result?.count ?? 0;
    },

    async deleteOldest(gameId: string): Promise<void> {
      const oldest = await db
        .select({ id: gameVersions.id })
        .from(gameVersions)
        .where(eq(gameVersions.gameId, gameId))
        .orderBy(asc(gameVersions.version))
        .limit(1);

      if (oldest.length > 0) {
        await db
          .delete(gameVersions)
          .where(eq(gameVersions.id, oldest[0].id));
      }
    },
  };
}

export type GameVersionRepository = ReturnType<
  typeof createGameVersionRepository
>;
