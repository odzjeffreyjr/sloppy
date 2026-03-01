import type {
  ConnectionState,
  MultiplayerClientOptions,
  JoinPayload,
  ServerMessage,
} from './types.js';

const DEFAULT_MAX_RECONNECT_ATTEMPTS = 5;
const DEFAULT_BASE_RECONNECT_DELAY = 1000;
const DEFAULT_MAX_RECONNECT_DELAY = 30_000;

type StateCallback = (state: Record<string, unknown>) => void;
type PlayerCallback = (playerId: string) => void;
type ErrorCallback = (error: string) => void;
type ConnectionCallback = (state: ConnectionState) => void;

/**
 * Client-side multiplayer SDK used by games to communicate
 * with the Sloppy multiplayer server over WebSocket.
 *
 * Handles connection, reconnection with exponential backoff,
 * input dispatch, and state synchronisation callbacks.
 */
export class MultiplayerClient {
  private ws: WebSocket | null = null;
  private state: ConnectionState = 'disconnected';
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private sessionId: string | null = null;
  private playerId: string | null = null;

  private readonly serverUrl: string;
  private readonly maxReconnectAttempts: number;
  private readonly baseReconnectDelay: number;
  private readonly maxReconnectDelay: number;

  private onStateUpdateCallbacks: StateCallback[] = [];
  private onPlayerJoinCallbacks: PlayerCallback[] = [];
  private onPlayerLeaveCallbacks: PlayerCallback[] = [];
  private onErrorCallbacks: ErrorCallback[] = [];
  private onConnectionChangeCallbacks: ConnectionCallback[] = [];

  constructor(options: MultiplayerClientOptions) {
    this.serverUrl = options.serverUrl;
    this.maxReconnectAttempts = options.maxReconnectAttempts ?? DEFAULT_MAX_RECONNECT_ATTEMPTS;
    this.baseReconnectDelay = options.baseReconnectDelay ?? DEFAULT_BASE_RECONNECT_DELAY;
    this.maxReconnectDelay = options.maxReconnectDelay ?? DEFAULT_MAX_RECONNECT_DELAY;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /** Connect to a multiplayer session. */
  connect(sessionId: string, playerId: string): void {
    this.sessionId = sessionId;
    this.playerId = playerId;
    this.reconnectAttempts = 0;
    this.openSocket();
  }

  /** Gracefully disconnect from the current session. */
  disconnect(): void {
    this.clearReconnectTimer();
    this.sessionId = null;
    this.playerId = null;
    this.reconnectAttempts = this.maxReconnectAttempts; // prevent auto-reconnect
    if (this.ws) {
      this.ws.close(1000, 'client disconnect');
      this.ws = null;
    }
    this.setState('disconnected');
  }

  /** Send a player input to the server. */
  sendInput(input: unknown): void {
    this.send('c2s:input', input);
  }

  /** Register a callback for authoritative state updates from the server. */
  onStateUpdate(callback: StateCallback): () => void {
    this.onStateUpdateCallbacks.push(callback);
    return () => {
      this.onStateUpdateCallbacks = this.onStateUpdateCallbacks.filter((cb) => cb !== callback);
    };
  }

  /** Register a callback for when a player joins the session. */
  onPlayerJoin(callback: PlayerCallback): () => void {
    this.onPlayerJoinCallbacks.push(callback);
    return () => {
      this.onPlayerJoinCallbacks = this.onPlayerJoinCallbacks.filter((cb) => cb !== callback);
    };
  }

  /** Register a callback for when a player leaves the session. */
  onPlayerLeave(callback: PlayerCallback): () => void {
    this.onPlayerLeaveCallbacks.push(callback);
    return () => {
      this.onPlayerLeaveCallbacks = this.onPlayerLeaveCallbacks.filter((cb) => cb !== callback);
    };
  }

  /** Register a callback for connection errors. */
  onError(callback: ErrorCallback): () => void {
    this.onErrorCallbacks.push(callback);
    return () => {
      this.onErrorCallbacks = this.onErrorCallbacks.filter((cb) => cb !== callback);
    };
  }

  /** Register a callback for connection state changes. */
  onConnectionChange(callback: ConnectionCallback): () => void {
    this.onConnectionChangeCallbacks.push(callback);
    return () => {
      this.onConnectionChangeCallbacks = this.onConnectionChangeCallbacks.filter(
        (cb) => cb !== callback,
      );
    };
  }

  /** Current connection state. */
  get connectionState(): ConnectionState {
    return this.state;
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private openSocket(): void {
    this.setState('connecting');

    const url = new URL(this.serverUrl);
    url.searchParams.set('sessionId', this.sessionId!);
    url.searchParams.set('playerId', this.playerId!);

    this.ws = new WebSocket(url.toString());

    this.ws.onopen = () => {
      this.setState('connected');
      this.reconnectAttempts = 0;
      this.sendJoin();
    };

    this.ws.onmessage = (event) => {
      this.handleMessage(event.data as string);
    };

    this.ws.onclose = (event) => {
      // Don't reconnect on intentional close
      if (event.code === 1000) {
        this.setState('disconnected');
        return;
      }
      this.attemptReconnect();
    };

    this.ws.onerror = () => {
      this.emitError('WebSocket connection error');
    };
  }

  private sendJoin(): void {
    const payload: JoinPayload = {
      sessionId: this.sessionId!,
      playerId: this.playerId!,
    };
    this.send('c2s:join', payload);
  }

  private send(event: string, data: unknown): void {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ event, data }));
  }

  private handleMessage(raw: string): void {
    let msg: ServerMessage;
    try {
      msg = JSON.parse(raw) as ServerMessage;
    } catch {
      return;
    }

    switch (msg.event) {
      case 's2c:state_update':
        for (const cb of this.onStateUpdateCallbacks) cb(msg.data as Record<string, unknown>);
        break;
      case 's2c:player_join':
        for (const cb of this.onPlayerJoinCallbacks) cb(msg.data as string);
        break;
      case 's2c:player_leave':
        for (const cb of this.onPlayerLeaveCallbacks) cb(msg.data as string);
        break;
      case 's2c:error':
        this.emitError(msg.data as string);
        break;
      case 's2c:session_closed':
        this.disconnect();
        break;
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.setState('disconnected');
      this.emitError('Max reconnection attempts reached');
      return;
    }

    this.setState('reconnecting');
    const delay = Math.min(
      this.baseReconnectDelay * 2 ** this.reconnectAttempts,
      this.maxReconnectDelay,
    );
    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(() => {
      this.openSocket();
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private setState(next: ConnectionState): void {
    if (this.state === next) return;
    this.state = next;
    for (const cb of this.onConnectionChangeCallbacks) cb(next);
  }

  private emitError(message: string): void {
    for (const cb of this.onErrorCallbacks) cb(message);
  }
}
