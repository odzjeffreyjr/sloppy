import Redis from 'ioredis';
import { config } from './config.js';

let redis: Redis | null = null;

export function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(config.redis.url, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });

    redis.on('error', (err) => {
      console.error('Redis connection error:', err.message);
    });
  }
  return redis;
}

export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}

const KEY_PREFIX = 'multiplayer';

function stateKey(sessionId: string): string {
  return `${KEY_PREFIX}:${sessionId}:state`;
}

function playerKey(sessionId: string, playerId: string): string {
  return `${KEY_PREFIX}:${sessionId}:player:${playerId}`;
}

function playersSetKey(sessionId: string): string {
  return `${KEY_PREFIX}:${sessionId}:players`;
}

export async function getGameState(
  sessionId: string,
): Promise<Record<string, unknown> | null> {
  const raw = await getRedis().get(stateKey(sessionId));
  return raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
}

export async function setGameState(
  sessionId: string,
  state: Record<string, unknown>,
): Promise<void> {
  await getRedis().set(
    stateKey(sessionId),
    JSON.stringify(state),
    'EX',
    config.redis.keyTtl,
  );
}

export async function getPlayerState(
  sessionId: string,
  playerId: string,
): Promise<Record<string, unknown> | null> {
  const raw = await getRedis().get(playerKey(sessionId, playerId));
  return raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
}

export async function setPlayerState(
  sessionId: string,
  playerId: string,
  state: Record<string, unknown>,
): Promise<void> {
  const r = getRedis();
  const pipeline = r.pipeline();
  pipeline.set(
    playerKey(sessionId, playerId),
    JSON.stringify(state),
    'EX',
    config.redis.keyTtl,
  );
  pipeline.sadd(playersSetKey(sessionId), playerId);
  pipeline.expire(playersSetKey(sessionId), config.redis.keyTtl);
  await pipeline.exec();
}

export async function removePlayerState(
  sessionId: string,
  playerId: string,
): Promise<void> {
  const r = getRedis();
  const pipeline = r.pipeline();
  pipeline.del(playerKey(sessionId, playerId));
  pipeline.srem(playersSetKey(sessionId), playerId);
  await pipeline.exec();
}

export async function getAllPlayerStates(
  sessionId: string,
): Promise<Record<string, Record<string, unknown>>> {
  const r = getRedis();
  const playerIds = await r.smembers(playersSetKey(sessionId));
  if (playerIds.length === 0) return {};

  const keys = playerIds.map((pid) => playerKey(sessionId, pid));
  const values = await r.mget(...keys);

  const result: Record<string, Record<string, unknown>> = {};
  for (let i = 0; i < playerIds.length; i++) {
    if (values[i]) {
      result[playerIds[i]] = JSON.parse(values[i]!) as Record<string, unknown>;
    }
  }
  return result;
}

export async function clearSessionKeys(sessionId: string): Promise<void> {
  const r = getRedis();
  const playerIds = await r.smembers(playersSetKey(sessionId));
  const keys = [
    stateKey(sessionId),
    playersSetKey(sessionId),
    ...playerIds.map((pid) => playerKey(sessionId, pid)),
  ];
  if (keys.length > 0) {
    await r.del(...keys);
  }
}
