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

/**
 * Returns true if the play should be counted (not debounced).
 * Uses a Redis key with TTL to enforce max 1 play per user per game per window.
 */
export async function tryRecordPlay(
  userId: string,
  gameId: string,
): Promise<boolean> {
  const key = `play_debounce:${userId}:${gameId}`;
  const result = await getRedis().set(
    key,
    '1',
    'EX',
    config.playDebounce.windowSeconds,
    'NX',
  );
  return result === 'OK';
}
