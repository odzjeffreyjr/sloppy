import type { Request, Response } from 'express';
import { config } from './config.js';

const startedAt = Date.now();

interface ServiceHealth {
  name: string;
  status: 'healthy' | 'unhealthy';
  latencyMs?: number;
  error?: string;
}

const SERVICE_HEALTH_ENDPOINTS: Record<string, string> = {
  auth: `${config.services.auth}/auth/health`,
  'game-builder': `${config.services.gameBuilder}/health`,
  'ai-orchestrator': `${config.services.aiOrchestrator}/health`,
  multiplayer: `${config.services.multiplayer}/health`,
};

async function checkService(
  name: string,
  url: string,
): Promise<ServiceHealth> {
  const start = Date.now();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5_000) });
    const latencyMs = Date.now() - start;
    if (!res.ok) {
      return { name, status: 'unhealthy', latencyMs, error: `HTTP ${res.status}` };
    }
    return { name, status: 'healthy', latencyMs };
  } catch (err) {
    return {
      name,
      status: 'unhealthy',
      latencyMs: Date.now() - start,
      error: (err as Error).message,
    };
  }
}

export async function healthCheck(_req: Request, res: Response): Promise<void> {
  const results = await Promise.all(
    Object.entries(SERVICE_HEALTH_ENDPOINTS).map(([name, url]) =>
      checkService(name, url),
    ),
  );

  const allHealthy = results.every((r) => r.status === 'healthy');

  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? 'ok' : 'degraded',
    service: 'api-gateway',
    version: process.env.npm_package_version ?? '0.0.0',
    uptime: Math.floor((Date.now() - startedAt) / 1000),
    services: results,
  });
}
