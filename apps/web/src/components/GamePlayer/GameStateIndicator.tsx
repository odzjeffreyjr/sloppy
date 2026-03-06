import { motion, AnimatePresence } from 'framer-motion';
import type { GameBridgeState } from '../../hooks/useGameBridge';

interface GameStateIndicatorProps {
  state: GameBridgeState;
}

const STATE_CONFIG: Record<GameBridgeState, { label: string; color: string; bg: string }> = {
  idle: { label: 'IDLE', color: 'text-sloppy-text/60', bg: 'bg-sloppy-surface' },
  intro: { label: 'INTRO', color: 'text-sloppy-secondary', bg: 'bg-sloppy-secondary/10' },
  playing: { label: 'PLAYING', color: 'text-sloppy-primary', bg: 'bg-sloppy-primary/10' },
  paused: { label: 'PAUSED', color: 'text-sloppy-accent', bg: 'bg-sloppy-accent/10' },
  gameover: { label: 'GAME OVER', color: 'text-sloppy-pink', bg: 'bg-sloppy-pink/10' },
};

export function GameStateIndicator({ state }: GameStateIndicatorProps) {
  const config = STATE_CONFIG[state];

  return (
    <AnimatePresence mode="wait">
      <motion.span
        key={state}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-body font-bold tracking-wider ${config.color} ${config.bg} border border-sloppy-border`}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.8 }}
        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
      >
        {state === 'playing' && (
          <motion.span
            className="w-1.5 h-1.5 rounded-full bg-current"
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.2, repeat: Infinity }}
          />
        )}
        {config.label}
      </motion.span>
    </AnimatePresence>
  );
}
