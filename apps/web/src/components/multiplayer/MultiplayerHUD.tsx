import { motion } from 'framer-motion';
import { useMultiplayerStore } from '../../stores/multiplayer';
import type { ConnectionState } from '../../stores/multiplayer';

const STATUS_STYLES: Record<
  ConnectionState,
  { bg: string; label: string; pulse: boolean }
> = {
  connected: { bg: 'bg-green-400', label: 'Connected', pulse: false },
  connecting: { bg: 'bg-yellow-400', label: 'Connecting', pulse: true },
  reconnecting: { bg: 'bg-yellow-400', label: 'Reconnecting', pulse: true },
  disconnected: { bg: 'bg-red-400', label: 'Disconnected', pulse: false },
};

export function MultiplayerHUD() {
  const { players, connectionState, leaveSession, isGameActive, ping } =
    useMultiplayerStore();

  if (!isGameActive) return null;

  const status = STATUS_STYLES[connectionState];

  return (
    <motion.div
      className="absolute top-4 right-4 z-20 flex flex-col gap-2 items-end"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.3, type: 'spring', stiffness: 300, damping: 25 }}
    >
      {/* Connection status, player count & ping */}
      <div className="flex items-center gap-2 bg-black/60 backdrop-blur-sm rounded-wobbly px-3 py-2">
        <motion.div
          className={`w-2.5 h-2.5 rounded-full ${status.bg}`}
          animate={status.pulse ? { opacity: [1, 0.3, 1] } : {}}
          transition={{ duration: 1, repeat: Infinity }}
          title={status.label}
        />
        <span className="text-white text-sm font-heading">
          👥 {players.length}
        </span>
        {ping > 0 && (
          <span className="text-white/50 text-xs font-body ml-1">
            {ping}ms
          </span>
        )}
      </div>

      {/* Leave session */}
      <motion.button
        className="cursor-pointer bg-red-500/80 hover:bg-red-500 backdrop-blur-sm text-white text-xs font-bold px-3 py-1.5 rounded-wobbly transition-colors"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={leaveSession}
      >
        Leave Session
      </motion.button>
    </motion.div>
  );
}
