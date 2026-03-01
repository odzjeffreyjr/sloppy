import type { WebSocket } from 'ws';
import { WS_EVENTS, WS_CLOSE_CODES } from '@sloppy/shared';
import { createLogger } from '@sloppy/logger';
import { config } from './config.js';
import {
  setGameState,
  getGameState,
  setPlayerState,
  removePlayerState,
  clearSessionKeys,
} from './redis.js';
import { startGameLoop, stopGameLoop } from './game-loop.js';

const log = createLogger('multiplayer');

export interface ConnectedPlayer {
  playerId: string;
  ws: WebSocket;
  alive: boolean;
}

export interface Room {
  sessionId: string;
  gameId: string;
  maxPlayers: number;
  players: Map<string, ConnectedPlayer>;
  inputQueue: Array<{ playerId: string; data: unknown }>;
  emptyAt: number | null;
  tickTimer: ReturnType<typeof setInterval> | null;
}

const rooms = new Map<string, Room>();

export function getRoomCount(): number {
  return rooms.size;
}

export function getRoom(sessionId: string): Room | undefined {
  return rooms.get(sessionId);
}

export function getAllRooms(): Map<string, Room> {
  return rooms;
}

export async function createRoom(
  sessionId: string,
  gameId: string,
  maxPlayers: number,
): Promise<Room> {
  if (rooms.has(sessionId)) {
    return rooms.get(sessionId)!;
  }

  const room: Room = {
    sessionId,
    gameId,
    maxPlayers: Math.min(maxPlayers, config.maxPlayersPerSession),
    players: new Map(),
    inputQueue: [],
    emptyAt: null,
    tickTimer: null,
  };

  rooms.set(sessionId, room);
  log.info({ sessionId, gameId, maxPlayers: room.maxPlayers }, 'room created');
  return room;
}

export async function addPlayerToRoom(
  sessionId: string,
  playerId: string,
  ws: WebSocket,
): Promise<boolean> {
  const room = rooms.get(sessionId);
  if (!room) return false;

  if (room.players.size >= room.maxPlayers) {
    ws.close(WS_CLOSE_CODES.SESSION_FULL, 'Session is full');
    return false;
  }

  if (room.players.has(playerId)) {
    const existing = room.players.get(playerId)!;
    try {
      existing.ws.close(WS_CLOSE_CODES.NORMAL, 'Replaced by new connection');
    } catch {
      // ignore
    }
  }

  room.players.set(playerId, { playerId, ws, alive: true });
  room.emptyAt = null;

  const defaultPlayerState: Record<string, unknown> = {
    id: playerId,
    x: 0,
    y: 0,
    velocity: 0,
    health: 100,
    score: 0,
  };
  await setPlayerState(sessionId, playerId, defaultPlayerState);

  const isFirstPlayer = room.players.size === 1;
  if (isFirstPlayer) {
    const existingState = await getGameState(sessionId);
    if (!existingState) {
      await setGameState(sessionId, { initialized: true, tick: 0 });
    }
    startGameLoop(room);
  }

  broadcast(room, WS_EVENTS.S2C_PLAYER_JOIN, {
    playerId,
    playerCount: room.players.size,
  });

  log.info({ sessionId, playerId, playerCount: room.players.size }, 'player joined');

  return true;
}

export async function removePlayerFromRoom(
  sessionId: string,
  playerId: string,
): Promise<void> {
  const room = rooms.get(sessionId);
  if (!room) return;

  room.players.delete(playerId);
  await removePlayerState(sessionId, playerId);

  broadcast(room, WS_EVENTS.S2C_PLAYER_LEAVE, {
    playerId,
    playerCount: room.players.size,
  });

  log.info({ sessionId, playerId, playerCount: room.players.size }, 'player left');

  if (room.players.size === 0) {
    room.emptyAt = Date.now();
    stopGameLoop(room);
    log.info({ sessionId, timeoutMs: config.cleanup.emptyRoomTimeoutMs }, 'room empty, scheduling cleanup');
  }
}

export async function destroyRoom(
  sessionId: string,
  reason = 'Session closed',
): Promise<void> {
  const room = rooms.get(sessionId);
  if (!room) return;

  stopGameLoop(room);

  broadcast(room, WS_EVENTS.S2C_SESSION_CLOSED, { reason });

  for (const player of room.players.values()) {
    try {
      player.ws.close(WS_CLOSE_CODES.SESSION_CLOSED, reason);
    } catch {
      // ignore
    }
  }

  room.players.clear();
  await clearSessionKeys(sessionId);
  rooms.delete(sessionId);

  log.info({ sessionId, reason }, 'room destroyed');
}

export function queueInput(
  sessionId: string,
  playerId: string,
  data: unknown,
): void {
  const room = rooms.get(sessionId);
  if (!room) return;
  room.inputQueue.push({ playerId, data });
}

export function broadcast(
  room: Room,
  event: string,
  data: unknown,
): void {
  const message = JSON.stringify({ event, data });
  for (const player of room.players.values()) {
    if (player.ws.readyState === player.ws.OPEN) {
      player.ws.send(message);
    }
  }
}

export function sendToPlayer(
  room: Room,
  playerId: string,
  event: string,
  data: unknown,
): void {
  const player = room.players.get(playerId);
  if (player && player.ws.readyState === player.ws.OPEN) {
    player.ws.send(JSON.stringify({ event, data }));
  }
}
