import { eq, and, lt, sql, inArray } from 'drizzle-orm';
import type { MultiplayerSession, SessionStatus } from '@sloppy/shared';
import { generateId } from '@sloppy/shared';
import type { Database } from '../connection.js';
import { sessions } from '../schema.js';
import { mapSession } from '../mappers.js';

export function createSessionRepository(db: Database) {
  return {
    async create(data: {
      gameId: string;
      hostId: string;
      maxPlayers?: number;
    }): Promise<MultiplayerSession> {
      const [row] = await db
        .insert(sessions)
        .values({
          id: generateId(),
          gameId: data.gameId,
          hostId: data.hostId,
          maxPlayers: data.maxPlayers ?? 4,
          playerCount: 1,
        })
        .returning();
      return mapSession(row);
    },

    async findById(id: string): Promise<MultiplayerSession | null> {
      const [row] = await db
        .select()
        .from(sessions)
        .where(eq(sessions.id, id));
      return row ? mapSession(row) : null;
    },

    async findActiveByGame(gameId: string): Promise<MultiplayerSession[]> {
      const rows = await db
        .select()
        .from(sessions)
        .where(
          and(
            eq(sessions.gameId, gameId),
            inArray(sessions.status, ['waiting', 'active']),
          ),
        );
      return rows.map(mapSession);
    },

    async updateStatus(
      id: string,
      status: SessionStatus,
    ): Promise<MultiplayerSession | null> {
      const updates: Record<string, unknown> = { status };
      if (status === 'closed') {
        updates.closedAt = new Date();
      }

      const [row] = await db
        .update(sessions)
        .set(updates)
        .where(eq(sessions.id, id))
        .returning();
      return row ? mapSession(row) : null;
    },

    async incrementPlayerCount(
      id: string,
    ): Promise<MultiplayerSession | null> {
      const [row] = await db
        .update(sessions)
        .set({ playerCount: sql`${sessions.playerCount} + 1` })
        .where(eq(sessions.id, id))
        .returning();
      return row ? mapSession(row) : null;
    },

    async decrementPlayerCount(
      id: string,
    ): Promise<MultiplayerSession | null> {
      const [row] = await db
        .update(sessions)
        .set({
          playerCount: sql`GREATEST(${sessions.playerCount} - 1, 0)`,
        })
        .where(eq(sessions.id, id))
        .returning();
      return row ? mapSession(row) : null;
    },

    /**
     * Close sessions that have been in 'waiting' or 'active' state for
     * longer than the specified duration.
     */
    async cleanupStale(
      maxAgeMs: number = 3 * 60 * 60 * 1000,
    ): Promise<number> {
      const cutoff = new Date(Date.now() - maxAgeMs);

      const rows = await db
        .update(sessions)
        .set({ status: 'closed', closedAt: new Date() })
        .where(
          and(
            inArray(sessions.status, ['waiting', 'active']),
            lt(sessions.createdAt, cutoff),
          ),
        )
        .returning({ id: sessions.id });

      return rows.length;
    },
  };
}

export type SessionRepository = ReturnType<typeof createSessionRepository>;
