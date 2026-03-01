import { createLogger } from '@sloppy/logger';
import { getAllRooms } from './room-manager.js';

const log = createLogger('multiplayer');

interface MultiplayerMetrics {
  concurrentSessions: number;
  concurrentConnections: number;
  messagesPerSecond: number;
  avgLatencyMs: number;
}

let messageCount = 0;
let lastMessageCheck = Date.now();
let latencySum = 0;
let latencySamples = 0;

export function recordMessage(): void {
  messageCount++;
}

export function recordLatency(ms: number): void {
  latencySum += ms;
  latencySamples++;
}

export function getMetrics(): MultiplayerMetrics {
  const now = Date.now();
  const elapsed = (now - lastMessageCheck) / 1000;
  const mps = elapsed > 0 ? messageCount / elapsed : 0;

  const rooms = getAllRooms();
  let totalConnections = 0;
  for (const room of rooms.values()) {
    totalConnections += room.players.size;
  }

  const avgLatency = latencySamples > 0 ? latencySum / latencySamples : 0;

  messageCount = 0;
  lastMessageCheck = now;
  latencySum = 0;
  latencySamples = 0;

  return {
    concurrentSessions: rooms.size,
    concurrentConnections: totalConnections,
    messagesPerSecond: Math.round(mps * 100) / 100,
    avgLatencyMs: Math.round(avgLatency * 100) / 100,
  };
}

let metricsTimer: ReturnType<typeof setInterval> | null = null;

export function startMetricsLogging(intervalMs = 60_000): void {
  if (metricsTimer) return;
  metricsTimer = setInterval(() => {
    const m = getMetrics();
    if (m.concurrentSessions > 0) {
      log.info(m, 'multiplayer metrics');
    }
  }, intervalMs);
}

export function stopMetricsLogging(): void {
  if (metricsTimer) {
    clearInterval(metricsTimer);
    metricsTimer = null;
  }
}
