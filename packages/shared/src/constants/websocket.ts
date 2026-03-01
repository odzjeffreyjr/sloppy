/**
 * WebSocket event names used between clients and the multiplayer server.
 * Prefixed with direction: `c2s` (client → server), `s2c` (server → client).
 */
export const WS_EVENTS = {
  // Client → Server
  C2S_JOIN: 'c2s:join',
  C2S_LEAVE: 'c2s:leave',
  C2S_INPUT: 'c2s:input',

  // Server → Client
  S2C_STATE_UPDATE: 's2c:state_update',
  S2C_PLAYER_JOIN: 's2c:player_join',
  S2C_PLAYER_LEAVE: 's2c:player_leave',
  S2C_SESSION_CLOSED: 's2c:session_closed',
  S2C_ERROR: 's2c:error',
} as const;

export type WsEvent = (typeof WS_EVENTS)[keyof typeof WS_EVENTS];

/** WebSocket close codes. */
export const WS_CLOSE_CODES = {
  NORMAL: 1000,
  SESSION_FULL: 4001,
  SESSION_CLOSED: 4002,
  UNAUTHORIZED: 4003,
  RATE_LIMITED: 4004,
} as const;
