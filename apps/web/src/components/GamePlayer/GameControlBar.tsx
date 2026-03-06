import { useState, useCallback, type RefObject } from 'react';
import { motion } from 'framer-motion';
import { useGameBridge, type GameBridgeState } from '../../hooks/useGameBridge';

interface GameControlBarProps {
  iframeRef: RefObject<HTMLIFrameElement | null>;
  src?: string;
  disabled?: boolean;
  onFullscreen?: () => void;
}

const BTN =
  'flex items-center gap-1.5 px-3 py-2 rounded-wobbly text-sm font-body font-semibold transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer';
const BTN_DEFAULT = `${BTN} bg-sloppy-surface hover:bg-sloppy-surface-hover text-sloppy-text border border-sloppy-border`;
const BTN_ACTIVE = `${BTN} bg-sloppy-primary/10 hover:bg-sloppy-primary/20 text-sloppy-primary border border-sloppy-primary/30`;

export function GameControlBar({ iframeRef, src, disabled = false, onFullscreen }: GameControlBarProps) {
  const { gameState, sendCommand } = useGameBridge(iframeRef, undefined, src);
  const [isMuted, setIsMuted] = useState(false);

  const isPlaying = gameState === 'playing';
  const isPaused = gameState === 'paused';
  const canStart = gameState === 'idle' || gameState === 'intro' || gameState === 'gameover';
  const canPause = isPlaying;
  const canResume = isPaused;

  const handleStart = useCallback(() => {
    sendCommand('start');
  }, [sendCommand]);

  const handlePauseResume = useCallback(() => {
    if (isPaused) {
      sendCommand('resume');
    } else if (isPlaying) {
      sendCommand('pause');
    }
  }, [isPaused, isPlaying, sendCommand]);

  const handleRestart = useCallback(() => {
    sendCommand('restart');
  }, [sendCommand]);

  const handleMuteToggle = useCallback(() => {
    sendCommand(isMuted ? 'unmute' : 'mute');
    setIsMuted((m) => !m);
  }, [isMuted, sendCommand]);

  return (
    <motion.div
      className="flex items-center gap-2 px-3 py-2 bg-sloppy-surface/80 backdrop-blur-sm rounded-wobbly border border-sloppy-border"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
    >
      {/* Start / Resume */}
      {(canStart || canResume) && (
        <motion.button
          className={BTN_ACTIVE}
          disabled={disabled}
          onClick={canResume ? handlePauseResume : handleStart}
          whileTap={{ scale: 0.93 }}
          aria-label={canResume ? 'Resume' : 'Start'}
        >
          <PlayIcon />
          <span className="hidden sm:inline">{canResume ? 'Resume' : 'Start'}</span>
        </motion.button>
      )}

      {/* Pause */}
      {canPause && (
        <motion.button
          className={BTN_DEFAULT}
          disabled={disabled}
          onClick={handlePauseResume}
          whileTap={{ scale: 0.93 }}
          aria-label="Pause"
        >
          <PauseIcon />
          <span className="hidden sm:inline">Pause</span>
        </motion.button>
      )}

      {/* Restart */}
      <motion.button
        className={BTN_DEFAULT}
        disabled={disabled || gameState === 'idle'}
        onClick={handleRestart}
        whileTap={{ scale: 0.93 }}
        aria-label="Restart"
      >
        <RestartIcon />
        <span className="hidden sm:inline">Restart</span>
      </motion.button>

      <div className="flex-1" />

      {/* Mute */}
      <motion.button
        className={isMuted ? BTN_ACTIVE : BTN_DEFAULT}
        disabled={disabled}
        onClick={handleMuteToggle}
        whileTap={{ scale: 0.93 }}
        aria-label={isMuted ? 'Unmute' : 'Mute'}
      >
        {isMuted ? <MuteIcon /> : <VolumeIcon />}
      </motion.button>

      {/* Fullscreen */}
      {onFullscreen && (
        <motion.button
          className={BTN_DEFAULT}
          disabled={disabled}
          onClick={onFullscreen}
          whileTap={{ scale: 0.93 }}
          aria-label="Fullscreen"
        >
          <FullscreenIcon />
        </motion.button>
      )}
    </motion.div>
  );
}

function PlayIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
    </svg>
  );
}

function RestartIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M1 4v6h6M23 20v-6h-6" />
      <path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15" />
    </svg>
  );
}

function VolumeIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M11 5L6 9H2v6h4l5 4V5z" />
      <path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" />
    </svg>
  );
}

function MuteIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M11 5L6 9H2v6h4l5 4V5z" />
      <line x1="23" y1="9" x2="17" y2="15" />
      <line x1="17" y1="9" x2="23" y2="15" />
    </svg>
  );
}

function FullscreenIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M8 3H5a2 2 0 00-2 2v3M21 8V5a2 2 0 00-2-2h-3M3 16v3a2 2 0 002 2h3M16 21h3a2 2 0 002-2v-3" />
    </svg>
  );
}

export type { GameBridgeState };
