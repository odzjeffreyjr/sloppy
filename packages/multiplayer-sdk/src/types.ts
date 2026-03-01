/** Connection state of the multiplayer client. */
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

/** Options for creating a MultiplayerClient. */
export interface MultiplayerClientOptions {
  /** WebSocket server URL (e.g. `wss://mp.sloppy.app`). */
  serverUrl: string;
  /** Maximum number of reconnection attempts before giving up. Defaults to 5. */
  maxReconnectAttempts?: number;
  /** Base delay in ms for exponential backoff. Defaults to 1000. */
  baseReconnectDelay?: number;
  /** Maximum backoff delay in ms. Defaults to 30000. */
  maxReconnectDelay?: number;
}

/** Payload sent with a join event. */
export interface JoinPayload {
  sessionId: string;
  playerId: string;
}

/** Incoming message from the server (parsed from JSON). */
export interface ServerMessage {
  event: string;
  data: unknown;
}
