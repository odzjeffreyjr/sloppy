export const config = {
  port: parseInt(process.env.PORT || '3005', 10),

  databaseUrl: process.env.DATABASE_URL!,

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    keyTtl: parseInt(process.env.REDIS_KEY_TTL || '3600', 10),
  },

  maxConcurrentSessions: parseInt(
    process.env.MAX_CONCURRENT_SESSIONS || '100',
    10,
  ),

  maxPlayersPerSession: Math.min(
    parseInt(process.env.MAX_PLAYERS_PER_SESSION || '4', 10),
    8,
  ),

  tickRate: parseInt(process.env.TICK_RATE || '20', 10),

  heartbeat: {
    intervalMs: parseInt(process.env.WS_HEARTBEAT_INTERVAL || '30000', 10),
    timeoutMs: parseInt(process.env.WS_HEARTBEAT_TIMEOUT || '10000', 10),
  },

  cleanup: {
    intervalMs: parseInt(process.env.CLEANUP_INTERVAL || '300000', 10),
    emptyRoomTimeoutMs: parseInt(
      process.env.EMPTY_ROOM_TIMEOUT || '60000',
      10,
    ),
  },
};
