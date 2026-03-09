export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  corsOrigin: (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),

  services: {
    auth: process.env.AUTH_SERVICE_URL || 'http://localhost:3002',
    gameBuilder: process.env.GAME_BUILDER_URL || 'http://localhost:3003',
    aiOrchestrator: process.env.AI_ORCHESTRATOR_URL || 'http://localhost:3004',
    multiplayer: process.env.MULTIPLAYER_URL || 'http://localhost:3005',
    payments: process.env.PAYMENTS_URL || 'http://localhost:3006',
  },

  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

  rateLimits: {
    generalAuthRpm: parseInt(
      process.env.RATE_LIMIT_GENERAL_AUTH_RPM || '100',
      10,
    ),
    generalUnauthRpm: parseInt(
      process.env.RATE_LIMIT_GENERAL_UNAUTH_RPM || '30',
      10,
    ),
    generationPerHour: parseInt(
      process.env.RATE_LIMIT_GENERATION_PER_HOUR || '5',
      10,
    ),
  },

  timeouts: {
    default: 30_000,
    generation: 1_200_000,
  },

  bodyLimit: '1mb',
};
