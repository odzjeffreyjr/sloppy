import type { SessionRepository } from '@sloppy/db';
import { createLogger } from '@sloppy/logger';
import { config } from './config.js';
import { getAllRooms, destroyRoom } from './room-manager.js';
import { clearSessionKeys } from './redis.js';

const log = createLogger('multiplayer');

let cleanupTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Starts the periodic cleanup job that:
 * 1. Closes stale DB sessions via the repository
 * 2. Destroys rooms that have been empty beyond the timeout
 * 3. Removes orphaned Redis keys
 */
export function startCleanupJob(sessionRepo: SessionRepository): void {
  if (cleanupTimer) return;

  cleanupTimer = setInterval(() => {
    void runCleanup(sessionRepo);
  }, config.cleanup.intervalMs);

  log.info({ intervalMs: config.cleanup.intervalMs }, 'cleanup job started');
}

export function stopCleanupJob(): void {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
    log.info('cleanup job stopped');
  }
}

async function runCleanup(sessionRepo: SessionRepository): Promise<void> {
  try {
    const staleCount = await sessionRepo.cleanupStale();
    if (staleCount > 0) {
      log.info({ staleCount }, 'closed stale DB sessions');
    }

    const rooms = getAllRooms();
    const now = Date.now();

    for (const [sessionId, room] of rooms) {
      if (
        room.emptyAt !== null &&
        now - room.emptyAt > config.cleanup.emptyRoomTimeoutMs
      ) {
        log.info({ sessionId }, 'destroying empty room');
        await sessionRepo.updateStatus(sessionId, 'closed');
        await destroyRoom(sessionId, 'Empty room timeout');
      }
    }

    for (const [sessionId, room] of rooms) {
      if (room.players.size === 0 && room.emptyAt === null) {
        await clearSessionKeys(sessionId);
        rooms.delete(sessionId);
      }
    }
  } catch (err) {
    log.error({ error: err }, 'cleanup error');
  }
}
