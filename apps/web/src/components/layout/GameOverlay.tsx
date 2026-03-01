import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUIStore } from '../../stores/ui';
import { useGameStore } from '../../stores/game';
import {
  useMultiplayerStore,
  setMultiplayerIframeWindow,
} from '../../stores/multiplayer';
import { useLobbyMusic } from '../../hooks/useLobbyMusic';
import { gamesApi } from '../../lib/api';
import { reportGameCrash } from '../../lib/crash-reporter';
import { SloppySpinner } from '../ui/SloppySpinner';
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
    navigate('/', { replace: true });
  }, [closeGameOverlay, navigate, resetMultiplayer]);

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

  // postMessage handler — game lifecycle + multiplayer input bridge + crash detection
  useEffect(() => {
    if (!isGameOverlayOpen) return;
    const handler = (e: MessageEvent) => {
      const type = e.data?.type;
      if (!type) return;
      if (type === 'sloppy:game:ready') {
        setIsIframeLoading(false);
      } else if (type === 'sloppy:multiplayer:input') {
        sendInput(e.data.input);
      } else if (type === 'sloppy:game:error' || type === 'error') {
        const errorMsg = e.data?.message ?? e.data?.error ?? 'Unknown game error';
        const stack = e.data?.stack ?? '';
        setIframeError(true);
        if (gameOverlayId) {
          reportGameCrash(gameOverlayId, errorMsg, stack);
        }
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [isGameOverlayOpen, sendInput, gameOverlayId]);

  // Pass the iframe window to the multiplayer store for outbound postMessage
  useEffect(() => {
    if (!isIframeLoading && iframeRef.current?.contentWindow) {
      setMultiplayerIframeWindow(iframeRef.current.contentWindow);
    }
    return () => setMultiplayerIframeWindow(null);
  }, [isIframeLoading]);

  // Use currentGame as the single source of truth for display
  const game = currentGame;

  const iframeSrc =
    game && gameOverlayId
      ? buildIframeSrc(gameOverlayId, game.version, game.storagePath)
      : null;

  return (
    <>
      <AnimatePresence>
        {isGameOverlayOpen && gameOverlayId && (
          <motion.div
            className="fixed inset-0 z-50 bg-sloppy-dark flex flex-col"
            style={{ height: '100dvh' }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            {/* Header bar */}
            <div className="flex items-center justify-between px-4 py-3 bg-sloppy-dark/80 backdrop-blur-sm border-b border-white/5 shrink-0">
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
                    👥
                  </motion.button>
                )}
                <motion.button
                  className="cursor-pointer text-2xl px-2 py-1"
                  whileHover={{ scale: 1.3 }}
                  whileTap={{ scale: 0.8 }}
                  onClick={handleFavouriteToggle}
                  aria-label={game?.isFavourited ? 'Unfavourite' : 'Favourite'}
                >
                  {game?.isFavourited ? '❤️' : '🤍'}
                </motion.button>
              </div>
            </div>

            {/* Game area */}
            <div className="flex-1 relative">
              {/* Loading spinner */}
              {isIframeLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-sloppy-dark z-10">
                  <div className="flex flex-col items-center gap-4">
                    <SloppySpinner size={64} />
                    <span className="font-heading text-white/60 text-lg">
                      Loading game...
                    </span>
                  </div>
                </div>
              )}

              {/* Error state */}
              {iframeError && (
                <div className="absolute inset-0 flex items-center justify-center bg-sloppy-dark z-10">
                  <div className="flex flex-col items-center gap-4">
                    <span className="text-5xl">💥</span>
                    <span className="font-heading text-white/60 text-lg">
                      Failed to load game
                    </span>
                    <motion.button
                      className="cursor-pointer px-5 py-2 bg-sloppy-pink text-white font-bold rounded-wobbly"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleClose}
                    >
                      Go Back
                    </motion.button>
                  </div>
                </div>
              )}

              {/* Sandboxed iframe */}
              {iframeSrc && (
                <iframe
                  ref={iframeRef}
                  src={iframeSrc}
                  sandbox="allow-scripts"
                  title={game?.title ?? 'Game'}
                  className="w-full h-full border-none"
                  onLoad={handleIframeLoad}
                  onError={handleIframeError}
                />
              )}

              {/* Multiplayer HUD (during active game) */}
              <MultiplayerHUD />

              {/* Multiplayer reconnection overlay */}
              <MultiplayerReconnect />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Multiplayer modal — rendered outside the overlay AnimatePresence so
          it gets its own z-layer and exit animation */}
      <MultiplayerModal />
    </>
  );
}
