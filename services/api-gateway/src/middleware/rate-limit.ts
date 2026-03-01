import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import type { Request } from 'express';
import { config } from '../config.js';
import { getRedisClient } from '../redis.js';

function sendCommand(...args: string[]): Promise<number> {
  const [command, ...rest] = args;
  return getRedisClient().call(command, ...rest) as Promise<number>;
}

export function createGeneralRateLimit() {
  return rateLimit({
    windowMs: 60_000,
    limit: (req: Request) =>
      req.user
        ? config.rateLimits.generalAuthRpm
        : config.rateLimits.generalUnauthRpm,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req: Request) => req.user?.uid || req.ip || 'unknown',
    store: new RedisStore({ sendCommand, prefix: 'rl:general:' }),
    message: {
      error: 'Too many requests',
      message: 'Rate limit exceeded. Please try again later.',
      statusCode: 429,
    },
  });
}

export function createGenerationRateLimit() {
  return rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: config.rateLimits.generationPerHour,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req: Request) => req.user?.uid || req.ip || 'unknown',
    store: new RedisStore({ sendCommand, prefix: 'rl:generation:' }),
    message: {
      error: 'Generation limit reached',
      message: `You can generate up to ${config.rateLimits.generationPerHour} games per hour. Please try again later.`,
      statusCode: 429,
    },
  });
}
