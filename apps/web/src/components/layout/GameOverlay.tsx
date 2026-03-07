import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Users, Heart } from 'lucide-react';
import { useUIStore } from '../../stores/ui';
import { useGameStore } from '../../stores/game';
import {
  useMultiplayerStore,
  setMultiplayerIframeWindow,
} from '../../stores/multiplayer';
import { useLobbyMusic } from '../../hooks/useLobbyMusic';
import { gamesApi } from '../../lib/api';
import { reportGameCrash } from '../../lib/crash-reporter';
import { GamePlayerShell, type GamePlayerMode } from '../GamePlayerShell';
import { MultiplayerModal } from '../multiplayer/MultiplayerModal';
import { MultiplayerHUD } from '../multiplayer/MultiplayerHUD';
import { MultiplayerReconnect } from '../multiplayer/MultiplayerReconnect';

const CDN_URL = import.meta.env.VITE_CDN_URL ?? '';

function buildIframeSrc(gameId: string, version: number, storagePath: string | null): string {
  if (storagePath) {
    return `${CDN_URL}/${storagePath}/index.html`;
  }
  return `${CDN_URL}/games/${gameId}/v${version}/index.html`;
}

export function GameOverlay() {
  const { isGameOverlayOpen, gameOverlayId, gameOverlayData, closeGameOverlay } = useUIStore();
  const { favouriteGame, unfavouriteGame, incrementPlayCount, currentGame, setCurrentGame } =
    useGameStore();
  const {
    isGameActive: isMultiplayerActive,
    openModal: openMultiplayer,
    reset: resetMultiplayer,
    sendInput,
  } = useMultiplayerStore();
  const navigate = useNavigate();
  const location = useLocation();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isIframeLoading, setIsIframeLoading] = useState(true);
  const [iframeError, setIframeError] = useState(false);

  useLobbyMusic(isGameOverlayOpen && isIframeLoading && !iframeError);
  const hasRecordedPlay = useRef<string | null>(null);

  // Seed currentGame from overlay data so the game store owns the live state
  useEffect(() => {
    if (isGameOverlayOpen && gameOverlayData) {
      setCurrentGame(gameOverlayData);
    }
  }, [isGameOverlayOpen, gameOverlayData, setCurrentGame]);

  // Fetch game data if we don't have it (e.g. direct URL navigation)
  useEffect(() => {
    if (isGameOverlayOpen && gameOverlayId && !gameOverlayData && !currentGame) {
      gamesApi.get(gameOverlayId).then((res) => {
        setCurrentGame(res.data);
      });
    }
  }, [isGameOverlayOpen, gameOverlayId, gameOverlayData, currentGame, setCurrentGame]);

  // Record play count once per overlay open
  useEffect(() => {
    if (isGameOverlayOpen && gameOverlayId && hasRecordedPlay.current !== gameOverlayId) {
      hasRecordedPlay.current = gameOverlayId;
      incrementPlayCount(gameOverlayId);
      gamesApi.play(gameOverlayId).catch(() => {});
    }
  }, [isGameOverlayOpen, gameOverlayId, incrementPlayCount]);

  // Reset state when overlay closes
  useEffect(() => {
    if (!isGameOverlayOpen) {
      setIsIframeLoading(true);
      setIframeError(false);
      hasRecordedPlay.current = null;
    }
  }, [isGameOverlayOpen]);

  // ── Callbacks ──────────────────────────────────────────────────────

  const handleClose = useCallback(() => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage({ type: 'sloppy:destroy' }, '*');
    }
    resetMultiplayer();
    closeGameOverlay();
    if (location.pathname.startsWith('/game/')) {
      navigate(-1);
    }
  }, [closeGameOverlay, location.pathname, navigate, resetMultiplayer]);

  const handleGameReady = useCallback(() => {
    setIsIframeLoading(false);
  }, []);

  const handleGameError = useCallback(
    (message: string, stack?: string) => {
      setIframeError(true);
      if (gameOverlayId) {
        reportGameCrash(gameOverlayId, message, stack);
      }
    },
    [gameOverlayId],
  );

  const handleIframeLoad = useCallback(() => {
    setIsIframeLoading(false);
  }, []);

  const handleIframeError = useCallback(() => {
    setIsIframeLoading(false);
    setIframeError(true);
    if (gameOverlayId) {
      reportGameCrash(gameOverlayId, 'iframe load error');
    }
  }, [gameOverlayId]);

  const handleFavouriteToggle = useCallback(() => {
    if (!currentGame) return;
    currentGame.isFavourited ? unfavouriteGame(currentGame.id) : favouriteGame(currentGame.id);
  }, [currentGame, favouriteGame, unfavouriteGame]);

  // ── Side-effect hooks ──────────────────────────────────────────────

  // Escape key handler
  useEffect(() => {
    if (!isGameOverlayOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isGameOverlayOpen, handleClose]);

  // Browser back button
  useEffect(() => {
    if (!isGameOverlayOpen) return;
    const handler = () => {
      closeGameOverlay();
    };
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, [isGameOverlayOpen, closeGameOverlay]);

  // postMessage handler — multiplayer input bridge
  useEffect(() => {
    if (!isGameOverlayOpen) return;
    const handler = (e: MessageEvent) => {
      const type = e.data?.type;
      if (!type) return;
      if (type === 'sloppy:multiplayer:input') {
        sendInput(e.data.input);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [isGameOverlayOpen, sendInput]);

  // Pass the iframe window to the multiplayer store for outbound postMessage
  useEffect(() => {
    if (!isIframeLoading && iframeRef.current?.contentWindow) {
      setMultiplayerIframeWindow(iframeRef.current.contentWindow);
    }
    return () => setMultiplayerIframeWindow(null);
  }, [isIframeLoading]);

  const game = currentGame;

  const iframeSrc =
    game && gameOverlayId
      ? buildIframeSrc(gameOverlayId, game.version, game.storagePath)
      : null;

  const playerMode: GamePlayerMode =
    typeof window !== 'undefined' && window.innerWidth < 768 ? 'overlay' : 'fullscreen';

  return (
    <>
      <AnimatePresence>
        {isGameOverlayOpen && gameOverlayId && (
          <motion.div
            className="fixed inset-0 z-50 bg-sloppy-bg flex flex-col"
            style={{ height: '100dvh' }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            {/* Header bar */}
            <div className="flex items-center justify-between px-4 py-3 bg-sloppy-bg/80 backdrop-blur-sm border-b border-white/5 shrink-0">
              {/* Close / back */}
              <motion.button
                className="cursor-pointer text-white text-lg px-3 py-1.5 rounded-wobbly hover:bg-white/10 flex items-center gap-2 font-heading"
                onClick={handleClose}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                aria-label="Close game"
              >
                <span className="text-xl">←</span> Back
              </motion.button>

              {/* Title */}
              <h2 className="font-heading text-white text-lg truncate max-w-[40%] text-center">
                {game?.title ?? 'Loading...'}
              </h2>

              {/* Right actions */}
              <div className="flex items-center gap-2">
                {game?.supportsMultiplayer && (
                  <motion.button
                    className="cursor-pointer text-white text-lg px-3 py-1.5 rounded-wobbly hover:bg-white/10"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={openMultiplayer}
                    aria-label="Multiplayer"
                  >
                    <Users size={20} />
                  </motion.button>
                )}
                <motion.button
                  className="cursor-pointer text-2xl px-2 py-1"
                  whileHover={{ scale: 1.3 }}
                  whileTap={{ scale: 0.8 }}
                  onClick={handleFavouriteToggle}
                  aria-label={game?.isFavourited ? 'Unfavourite' : 'Favourite'}
                >
                  <Heart size={20} fill={game?.isFavourited ? 'currentColor' : 'none'} className={game?.isFavourited ? 'text-sloppy-danger' : 'text-white'} />
                </motion.button>
              </div>
            </div>

            {/* Game area — now uses GamePlayerShell */}
            <div className="flex-1 relative">
              {iframeSrc && (
                <GamePlayerShell
                  src={iframeSrc}
                  title={game?.title ?? 'Game'}
                  mode={playerMode}
                  iframeRef={iframeRef}
                  onReady={handleGameReady}
                  onError={handleGameError}
                  onIframeLoad={handleIframeLoad}
                  onIframeError={handleIframeError}
                  showFullscreenToggle
                >
                  {/* Multiplayer HUD (during active game) */}
                  <MultiplayerHUD />
                  {/* Multiplayer reconnection overlay */}
                  <MultiplayerReconnect />
                </GamePlayerShell>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <MultiplayerModal />
    </>
  );
}
