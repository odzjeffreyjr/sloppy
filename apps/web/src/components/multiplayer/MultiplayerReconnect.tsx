import { motion, AnimatePresence } from 'framer-motion';
import { useMultiplayerStore } from '../../stores/multiplayer';
import type { DisconnectReason } from '../../stores/multiplayer';
import { SloppyButton } from '../ui/SloppyButton';
import { SloppySpinner } from '../ui/SloppySpinner';

const DISCONNECT_MESSAGES: Record<
  Exclude<DisconnectReason, null | 'left'>,
  { title: string; subtitle: string; emoji: string }
> = {
  host_left: {
    title: 'Host Left the Game',
    subtitle: 'The session has been closed by the host.',
    emoji: '👋',
  },
  connection_lost: {
    title: 'Connection Lost',
    subtitle: "We couldn't reconnect to the server after multiple attempts.",
    emoji: '📡',
  },
};

export function MultiplayerReconnect() {
  const {
    connectionState,
    disconnectReason,
    isGameActive,
    session,
    leaveSession,
    connect,
  } = useMultiplayerStore();

  const isReconnecting = connectionState === 'reconnecting' && isGameActive;
  const showDisconnect =
    isGameActive &&
    disconnectReason !== null &&
    disconnectReason !== 'left';
  const showOverlay = isReconnecting || showDisconnect;

  return (
    <AnimatePresence>
      {showOverlay && (
        <motion.div
          className="absolute inset-0 z-30 flex items-center justify-center bg-sloppy-dark/80 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {isReconnecting && !showDisconnect ? (
            <motion.div
              className="flex flex-col items-center gap-4"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
            >
              <SloppySpinner size={64} />
              <p className="font-heading text-white text-xl">
                Reconnecting…
              </p>
              <p className="text-white/50 text-sm">
                Attempting to restore your connection
              </p>
            </motion.div>
          ) : showDisconnect && disconnectReason ? (
            <motion.div
              className="flex flex-col items-center gap-4 max-w-sm text-center px-6"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
            >
              <span className="text-6xl">
                {DISCONNECT_MESSAGES[disconnectReason].emoji}
              </span>
              <h3 className="font-heading text-white text-2xl">
                {DISCONNECT_MESSAGES[disconnectReason].title}
              </h3>
              <p className="text-white/60">
                {DISCONNECT_MESSAGES[disconnectReason].subtitle}
              </p>
              <div className="flex gap-3 mt-2">
                {disconnectReason === 'connection_lost' && session && (
                  <SloppyButton
                    variant="secondary"
                    onClick={() => connect(session.id)}
                  >
                    Rejoin
                  </SloppyButton>
                )}
                <SloppyButton onClick={leaveSession}>Go Back</SloppyButton>
              </div>
            </motion.div>
          ) : null}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
