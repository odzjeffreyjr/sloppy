import { WS_EVENTS } from '@sloppy/shared';
import { config } from './config.js';
import type { Room } from './room-manager.js';
import { broadcast } from './room-manager.js';
import {
  getGameState,
  setGameState,
  getPlayerState,
  setPlayerState,
  getAllPlayerStates,
} from './redis.js';

/**
 * Start the authoritative game loop for a room.
 * Runs at the configured tick rate, collecting queued inputs,
 * applying them to player state, and broadcasting the result.
 */
export function startGameLoop(room: Room): void {
  if (room.tickTimer) return;

  const intervalMs = Math.floor(1000 / config.tickRate);

  room.tickTimer = setInterval(() => {
    void tick(room);
  }, intervalMs);

  console.log(
    `[tick] started session=${room.sessionId} rate=${config.tickRate}hz`,
  );
}

export function stopGameLoop(room: Room): void {
  if (room.tickTimer) {
    clearInterval(room.tickTimer);
    room.tickTimer = null;
    console.log(`[tick] stopped session=${room.sessionId}`);
  }
}

async function tick(room: Room): Promise<void> {
  try {
    const inputs = room.inputQueue.splice(0);

    for (const { playerId, data } of inputs) {
      const current = (await getPlayerState(room.sessionId, playerId)) ?? {
        id: playerId,
        x: 0,
        y: 0,
        velocity: 0,
        health: 100,
        score: 0,
      };

      if (data && typeof data === 'object') {
        Object.assign(current, data);
      }

      await setPlayerState(room.sessionId, playerId, current);
    }

    const gameState = (await getGameState(room.sessionId)) ?? {};
    gameState.tick = ((gameState.tick as number) ?? 0) + 1;
    await setGameState(room.sessionId, gameState);

    const players = await getAllPlayerStates(room.sessionId);

    broadcast(room, WS_EVENTS.S2C_STATE_UPDATE, { gameState, players });
  } catch (err) {
    console.error(`[tick] error session=${room.sessionId}:`, err);
  }
}
