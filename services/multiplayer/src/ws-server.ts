import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'node:http';
import type { IncomingMessage } from 'node:http';
import { WS_EVENTS, WS_CLOSE_CODES } from '@sloppy/shared';
import { getFirebaseAuth } from '@sloppy/auth-middleware';
import { createLogger } from '@sloppy/logger';
import { config } from './config.js';
import {
  getRoom,
  addPlayerToRoom,
  removePlayerFromRoom,
  queueInput,
} from './room-manager.js';
import { recordMessage } from './metrics.js';

const log = createLogger('multiplayer');

interface AuthenticatedSocket extends WebSocket {
  playerId: string;
  sessionId: string;
  isAlive: boolean;
}

export function createWebSocketServer(httpServer: Server): WebSocketServer {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    void handleConnection(ws as AuthenticatedSocket, req);
  });

  const pendingTimeouts = new Map<WebSocket, ReturnType<typeof setTimeout>>();

  const heartbeat = setInterval(() => {
    for (const client of wss.clients) {
      const socket = client as AuthenticatedSocket;
      socket.isAlive = false;
      socket.ping();

      const timeout = setTimeout(() => {
        if (!socket.isAlive) {
          log.warn({ playerId: socket.playerId, sessionId: socket.sessionId }, 'heartbeat timeout');
          pendingTimeouts.delete(socket);
          socket.terminate();
        }
      }, config.heartbeat.timeoutMs);

      pendingTimeouts.set(socket, timeout);
    }
  }, config.heartbeat.intervalMs);

  wss.on('close', () => {
    clearInterval(heartbeat);
    for (const timeout of pendingTimeouts.values()) {
      clearTimeout(timeout);
    }
    pendingTimeouts.clear();
  });

  log.info('WebSocket server attached at /ws');
  return wss;
}

async function handleConnection(
  ws: AuthenticatedSocket,
  req: IncomingMessage,
): Promise<void> {
  const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
  const sessionId = url.searchParams.get('sessionId');
  const playerId = url.searchParams.get('playerId');
  const token = url.searchParams.get('token');

  if (!sessionId || !playerId) {
    ws.close(WS_CLOSE_CODES.UNAUTHORIZED, 'Missing sessionId or playerId');
    return;
  }

  if (token) {
    try {
      await getFirebaseAuth().verifyIdToken(token);
    } catch {
      ws.close(WS_CLOSE_CODES.UNAUTHORIZED, 'Invalid authentication token');
      return;
    }
  }

  const room = getRoom(sessionId);
  if (!room) {
    ws.close(WS_CLOSE_CODES.SESSION_CLOSED, 'Session not found');
    return;
  }

  ws.sessionId = sessionId;
  ws.playerId = playerId;
  ws.isAlive = true;

  ws.on('pong', () => {
    ws.isAlive = true;
  });

  ws.on('message', (raw) => {
    handleMessage(ws, raw.toString());
  });

  ws.on('close', () => {
    void removePlayerFromRoom(sessionId, playerId);
  });

  ws.on('error', (err) => {
    log.error({ playerId, sessionId, error: err.message }, 'websocket error');
  });

  const joined = await addPlayerToRoom(sessionId, playerId, ws);
  if (!joined) {
    return;
  }
}

function handleMessage(ws: AuthenticatedSocket, raw: string): void {
  let msg: { event?: string; type?: string; data?: unknown };
  try {
    msg = JSON.parse(raw) as { event?: string; type?: string; data?: unknown };
  } catch {
    sendError(ws, 'Invalid JSON', 'INVALID_MESSAGE');
    return;
  }

  recordMessage();

  const event = msg.event ?? msg.type;

  switch (event) {
    case WS_EVENTS.C2S_INPUT:
    case 'input':
      queueInput(ws.sessionId, ws.playerId, msg.data);
      break;

    case 'ping':
      ws.isAlive = true;
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ event: 'pong' }));
      }
      break;

    case WS_EVENTS.C2S_JOIN:
      break;

    case WS_EVENTS.C2S_LEAVE:
      void removePlayerFromRoom(ws.sessionId, ws.playerId);
      ws.close(WS_CLOSE_CODES.NORMAL, 'Player left');
      break;

    default:
      sendError(ws, `Unknown event: ${event}`, 'UNKNOWN_EVENT');
  }
}

function sendError(ws: WebSocket, message: string, code: string): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(
      JSON.stringify({
        event: WS_EVENTS.S2C_ERROR,
        data: { message, code },
      }),
    );
  }
}
