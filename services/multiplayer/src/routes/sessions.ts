import { Router } from 'express';
import type { Request, Response } from 'express';
import type { SessionRepository, GameRepository } from '@sloppy/db';
import { config } from '../config.js';
import { createRoom, getRoom, getRoomCount } from '../room-manager.js';

export function sessionsRouter(
  sessionRepo: SessionRepository,
  gameRepo: GameRepository,
): Router {
  const router = Router();

  router.post('/sessions', async (req: Request, res: Response) => {
    try {
      const userId = req.headers['x-user-uid'] as string | undefined;
      if (!userId) {
        res.status(401).json({
          error: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
        return;
      }

      const { gameId, maxPlayers } = req.body as {
        gameId?: string;
        maxPlayers?: number;
      };

      if (!gameId) {
        res.status(400).json({
          error: 'gameId is required',
          code: 'MISSING_GAME_ID',
        });
        return;
      }

      if (getRoomCount() >= config.maxConcurrentSessions) {
        res.status(503).json({
          error: 'Maximum concurrent sessions reached',
          code: 'MAX_SESSIONS',
        });
        return;
      }

      const game = await gameRepo.findById(gameId);
      if (!game) {
        res.status(404).json({
          error: 'Game not found',
          code: 'GAME_NOT_FOUND',
        });
        return;
      }

      if (!game.supportsMultiplayer) {
        res.status(400).json({
          error: 'Game does not support multiplayer',
          code: 'MULTIPLAYER_NOT_SUPPORTED',
        });
        return;
      }

      const clampedMax = Math.min(
        maxPlayers ?? config.maxPlayersPerSession,
        config.maxPlayersPerSession,
      );

      const session = await sessionRepo.create({
        gameId,
        hostId: userId,
        maxPlayers: clampedMax,
      });

      await createRoom(session.id, gameId, clampedMax);

      console.log(
        `[session] created id=${session.id} game=${gameId} host=${userId}`,
      );

      res.status(201).json({ data: session });
    } catch (err) {
      console.error('[session] create error:', err);
      res.status(500).json({
        error: 'Failed to create session',
        code: 'INTERNAL_ERROR',
      });
    }
  });

  router.get('/sessions/:id', async (req: Request<{ id: string }>, res: Response) => {
    try {
      const session = await sessionRepo.findById(req.params.id);
      if (!session) {
        res.status(404).json({
          error: 'Session not found',
          code: 'SESSION_NOT_FOUND',
        });
        return;
      }

      const room = getRoom(session.id);
      res.json({
        data: {
          ...session,
          connectedPlayers: room ? room.players.size : 0,
        },
      });
    } catch (err) {
      console.error('[session] get error:', err);
      res.status(500).json({
        error: 'Failed to get session',
        code: 'INTERNAL_ERROR',
      });
    }
  });

  router.post('/sessions/:id/join', async (req: Request<{ id: string }>, res: Response) => {
    try {
      const userId = req.headers['x-user-uid'] as string | undefined;
      if (!userId) {
        res.status(401).json({
          error: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
        return;
      }

      const session = await sessionRepo.findById(req.params.id);
      if (!session) {
        res.status(404).json({
          error: 'Session not found',
          code: 'SESSION_NOT_FOUND',
        });
        return;
      }

      if (session.status === 'closed') {
        res.status(410).json({
          error: 'Session is closed',
          code: 'SESSION_CLOSED',
        });
        return;
      }

      const game = await gameRepo.findById(session.gameId);
      if (game && !game.supportsMultiplayer) {
        res.status(400).json({
          error: 'Game does not support multiplayer',
          code: 'MULTIPLAYER_NOT_SUPPORTED',
        });
        return;
      }

      const room = getRoom(session.id);
      if (!room) {
        await createRoom(session.id, session.gameId, session.maxPlayers);
      }

      const currentRoom = getRoom(session.id)!;
      if (currentRoom.players.size >= currentRoom.maxPlayers) {
        res.status(409).json({
          error: 'Session is full',
          code: 'SESSION_FULL',
        });
        return;
      }

      await sessionRepo.incrementPlayerCount(session.id);

      if (session.status === 'waiting') {
        await sessionRepo.updateStatus(session.id, 'active');
      }

      console.log(
        `[session] join id=${session.id} user=${userId}`,
      );

      const updated = await sessionRepo.findById(session.id);

      res.json({ data: updated ?? session });
    } catch (err) {
      console.error('[session] join error:', err);
      res.status(500).json({
        error: 'Failed to join session',
        code: 'INTERNAL_ERROR',
      });
    }
  });

  return router;
}
