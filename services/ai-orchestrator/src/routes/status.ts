import { Router } from 'express';
import { SessionManager } from '../session/manager.js';

export function statusRouter(): Router {
  const router = Router();
  const sessionManager = new SessionManager();

  router.get('/:sessionId/status', async (req, res) => {
    const { sessionId } = req.params;

    const session = await sessionManager.get(sessionId);
    if (!session) {
      res.status(404).json({ error: 'Not Found', message: 'Generation session not found', statusCode: 404 });
      return;
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    function sendEvent(data: unknown): void {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    }

    // Send current state immediately
    sendEvent({
      phase: session.currentPhase,
      progress: session.progress,
      message: session.message,
      ...(session.error ? { error: session.error } : {}),
      ...(session.status === 'completed'
        ? {
            completed: true,
            ...(session.gameId ? { gameId: session.gameId } : {}),
            ...(session.title ? { title: session.title } : {}),
            ...(session.description ? { description: session.description } : {}),
          }
        : {}),
    });

    if (session.status === 'completed' || session.status === 'failed') {
      res.end();
      return;
    }

    // Subscribe to live updates
    const unsubscribe = sessionManager.subscribeToUpdates(
      sessionId,
      (status) => {
        sendEvent(status);

        if (status.error || status.completed) {
          cleanup();
        }
      },
      (err) => {
        console.error(`SSE subscription error for ${sessionId}:`, err);
        cleanup();
      },
    );

    // Heartbeat to detect disconnects
    const heartbeat = setInterval(() => {
      res.write(':heartbeat\n\n');
    }, 15_000);

    let cleaned = false;
    function cleanup(): void {
      if (cleaned) return;
      cleaned = true;
      clearInterval(heartbeat);
      unsubscribe();
      res.end();
    }

    req.on('close', cleanup);
  });

  return router;
}
