import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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

function useIsMobileLandscape() {
  const [val, setVal] = useState(false);
  useEffect(() => {
    const check = () => {
      const isMobile = 'ontouchstart' in window || window.innerWidth < 1024;
      setVal(isMobile && window.innerWidth > window.innerHeight);
    };
    check();
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);
    return () => {
      window.removeEventListener('resize', check);
      window.removeEventListener('orientationchange', check);
    };
  }, []);
  return val;
}

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
    const didNavigate = useUIStore.getState().gameOverlayNavigated;
    closeGameOverlay();
    if (didNavigate) {
      const idx = (window.history.state as { idx?: number } | null)?.idx;
      if (typeof idx === 'number' && idx > 0) {
        navigate(-1);
      } else {
        navigate('/', { replace: true });
      }
    }
  }, [closeGameOverlay, navigate, resetMultiplayer]);

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
  const isMobileLandscape = useIsMobileLandscape();

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
            className="fixed inset-0 z-50 bg-black flex flex-col"
            style={{ height: '100dvh' }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            {/* Header bar — hidden on mobile landscape for true fullscreen */}
            {!isMobileLandscape && (
              <div className="flex items-center justify-between px-2 sm:px-4 py-2 sm:py-3 bg-sloppy-bg/80 backdrop-blur-sm border-b border-white/5 shrink-0">
                <motion.button
                  className="cursor-pointer text-white text-lg px-2 sm:px-3 py-1.5 rounded-wobbly hover:bg-white/10 flex items-center gap-1 sm:gap-2 font-heading shrink-0"
                  onClick={handleClose}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  aria-label="Close game"
                >
                  <span className="text-xl">←</span> <span className="hidden sm:inline">Back</span>
                </motion.button>

                <h2 className="font-heading text-white text-sm sm:text-lg truncate max-w-[35%] sm:max-w-[40%] text-center min-w-0">
                  {game?.title ?? 'Loading...'}
                </h2>

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
            )}

            {/* Floating close button in mobile landscape (top-left corner) */}
            {isMobileLandscape && (
              <motion.button
                className="absolute top-2 left-2 z-[60] cursor-pointer w-9 h-9 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center border-0 text-white/70 hover:text-white hover:bg-black/70 transition-colors"
                whileTap={{ scale: 0.85 }}
                onClick={handleClose}
                aria-label="Close game"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </motion.button>
            )}

            {/* Game area */}
            <div className="flex-1 relative">
              {iframeSrc && (
                <GamePlayerShell
                  src={iframeSrc}
                  title={game?.title ?? 'Game'}
                  mode={playerMode}
                  genre={game?.genre ?? undefined}
                  scaleMode="fill"
                  iframeRef={iframeRef}
                  onReady={handleGameReady}
                  onError={handleGameError}
                  onIframeLoad={handleIframeLoad}
                  onIframeError={handleIframeError}
                  showFullscreenToggle={!isMobileLandscape}
                >
                  <MultiplayerHUD />
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
