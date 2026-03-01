import { motion, AnimatePresence } from 'framer-motion';
import { useState, useCallback, useEffect } from 'react';
import { useMultiplayerStore, formatSessionCode } from '../../stores/multiplayer';
import { useUIStore } from '../../stores/ui';
import { SloppyButton } from '../ui/SloppyButton';
import { SloppyInput } from '../ui/SloppyInput';
import { SloppySpinner } from '../ui/SloppySpinner';

const APP_URL =
  import.meta.env.VITE_APP_URL ??
  (typeof window !== 'undefined' ? window.location.origin : '');

// ── Small helpers ────────────────────────────────────────────────────

function WaitingDots() {
  return (
    <span className="inline-flex">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="inline-block"
          animate={{ opacity: [0.2, 1, 0.2] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.3 }}
        >
          .
        </motion.span>
      ))}
    </span>
  );
}

// ── Create Tab ───────────────────────────────────────────────────────

function CreateTab() {
  const { error, createSession } = useMultiplayerStore();
  const gameId = useUIStore((s) => s.gameOverlayId);
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    if (!gameId) return;
    setIsCreating(true);
    await createSession(gameId);
    setIsCreating(false);
  };

  return (
    <div className="flex flex-col items-center gap-4 py-6">
      <p className="text-sloppy-dark/60 text-center text-sm">
        Create a new multiplayer session and invite your friends!
      </p>

      {error && (
        <motion.p
          className="text-red-500 text-sm text-center"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {error}
        </motion.p>
      )}

      <SloppyButton
        onClick={handleCreate}
        disabled={isCreating || !gameId}
        className="w-full"
      >
        {isCreating ? (
          <span className="flex items-center justify-center gap-2">
            <SloppySpinner size={20} /> Creating…
          </span>
        ) : (
          '🎮 Create Session'
        )}
      </SloppyButton>
    </div>
  );
}

// ── Join Tab ─────────────────────────────────────────────────────────

function JoinTab() {
  const { error, joinSession, clearError } = useMultiplayerStore();
  const [code, setCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  const handleJoin = async () => {
    if (!code.trim()) return;
    setIsJoining(true);
    await joinSession(code);
    setIsJoining(false);
  };

  return (
    <div className="flex flex-col gap-4 py-6">
      <p className="text-sloppy-dark/60 text-center text-sm">
        Enter a session code or paste an invite link to join.
      </p>

      <SloppyInput
        value={code}
        onChange={(e) => {
          setCode(e.target.value);
          clearError();
        }}
        onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
        placeholder="Paste session code or link…"
        accentColor="cyan"
      />

      {error && (
        <motion.p
          className="text-red-500 text-sm text-center"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {error}
        </motion.p>
      )}

      <SloppyButton
        variant="secondary"
        onClick={handleJoin}
        disabled={isJoining || !code.trim()}
        className="w-full"
      >
        {isJoining ? (
          <span className="flex items-center justify-center gap-2">
            <SloppySpinner size={20} /> Joining…
          </span>
        ) : (
          '🚀 Join Session'
        )}
      </SloppyButton>
    </div>
  );
}

// ── Lobby View ───────────────────────────────────────────────────────

function LobbyView() {
  const { session, isHost, players, startGame } = useMultiplayerStore();
  const gameId = useUIStore((s) => s.gameOverlayId);
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);

  if (!session) return null;

  const sessionCode = formatSessionCode(session.id);
  const canStart = isHost && players.length >= 2;

  const handleCopy = (type: 'code' | 'link') => {
    const text =
      type === 'code'
        ? session.id
        : `${APP_URL}/game/${gameId}?session=${session.id}`;
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Session code & share (host only) */}
      {isHost && (
        <div className="bg-sloppy-cream rounded-wobbly p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs text-sloppy-dark/50 font-body uppercase tracking-wider">
                Session Code
              </p>
              <p className="font-heading text-2xl text-sloppy-dark">
                {sessionCode}
              </p>
            </div>
            <motion.button
              className="cursor-pointer px-3 py-1.5 bg-sloppy-dark/10 rounded-wobbly text-sm font-bold"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleCopy('code')}
            >
              {copied === 'code' ? '✓ Copied!' : '📋 Copy Code'}
            </motion.button>
          </div>

          <motion.button
            className="cursor-pointer w-full py-2 bg-sloppy-cyan/20 text-sloppy-dark rounded-wobbly text-sm font-bold hover:bg-sloppy-cyan/30 transition-colors"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleCopy('link')}
          >
            {copied === 'link' ? '✓ Link Copied!' : '🔗 Copy Invite Link'}
          </motion.button>
        </div>
      )}

      {/* Player count header */}
      <div className="flex items-center justify-between">
        <h3 className="font-heading text-lg text-sloppy-dark">Players</h3>
        <span className="text-sm font-bold text-sloppy-dark/60">
          {players.length}/{session.maxPlayers}
        </span>
      </div>

      {/* Player list */}
      <div className="space-y-2">
        <AnimatePresence mode="popLayout">
          {players.map((player) => (
            <motion.div
              key={player.id}
              className="flex items-center gap-3 p-3 bg-sloppy-cream rounded-wobbly"
              initial={{ opacity: 0, x: -20, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              layout
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-xl shrink-0"
                style={{
                  border: `3px solid ${player.color}`,
                  backgroundColor: `${player.color}20`,
                }}
              >
                {player.avatar}
              </div>
              <span className="font-heading text-sloppy-dark flex-1 truncate">
                {player.displayName || player.id.slice(0, 8)}
              </span>
              {player.isHost && (
                <span className="text-lg" title="Host">
                  👑
                </span>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Start / Waiting */}
      <div className="pt-2">
        {isHost ? (
          <>
            <p className="text-center text-sm text-sloppy-dark/50 mb-3">
              {players.length < 2 ? (
                <>
                  Waiting for players to join
                  <WaitingDots />
                </>
              ) : (
                'Ready to start!'
              )}
            </p>
            <SloppyButton
              onClick={startGame}
              disabled={!canStart}
              className={`w-full ${!canStart ? 'opacity-50' : ''}`}
            >
              🎮 Start Game
            </SloppyButton>
          </>
        ) : (
          <div className="text-center py-4">
            <p className="text-sloppy-dark/60 font-body">
              Waiting for host to start
              <WaitingDots />
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Modal Container ──────────────────────────────────────────────────

export function MultiplayerModal() {
  const { session, isModalOpen, closeModal, leaveSession } =
    useMultiplayerStore();
  const [activeTab, setActiveTab] = useState<'create' | 'join'>('create');
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const handleClose = useCallback(() => {
    if (session) {
      leaveSession();
    } else {
      closeModal();
    }
  }, [session, leaveSession, closeModal]);

  const inLobby = !!session;

  return (
    <AnimatePresence>
      {isModalOpen && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-end md:items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={handleClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Content — bottom sheet on mobile, centered card on desktop */}
          <motion.div
            className="relative z-10 w-full md:max-w-lg bg-white rounded-t-3xl md:rounded-wobbly-lg p-6 max-h-[85vh] overflow-y-auto"
            initial={
              isMobile
                ? { y: '100%' }
                : { scale: 0.5, rotate: -5, opacity: 0 }
            }
            animate={
              isMobile ? { y: 0 } : { scale: 1, rotate: 0, opacity: 1 }
            }
            exit={
              isMobile
                ? { y: '100%' }
                : { scale: 0.5, rotate: 5, opacity: 0 }
            }
            transition={{ type: 'spring', stiffness: 300, damping: 22 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading text-2xl text-sloppy-dark">
                {inLobby ? '🎮 Lobby' : '👥 Multiplayer'}
              </h2>
              <motion.button
                className="cursor-pointer text-sloppy-dark/40 hover:text-sloppy-dark text-xl p-1"
                onClick={handleClose}
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
              >
                ✕
              </motion.button>
            </div>

            {inLobby ? (
              <LobbyView />
            ) : (
              <>
                {/* Tab bar */}
                <div className="flex rounded-wobbly bg-sloppy-cream p-1 mb-4">
                  {(['create', 'join'] as const).map((tab) => (
                    <motion.button
                      key={tab}
                      className={`cursor-pointer flex-1 py-2 px-4 rounded-wobbly text-sm font-heading font-bold transition-colors ${
                        activeTab === tab
                          ? 'bg-white text-sloppy-dark shadow-sm'
                          : 'text-sloppy-dark/50 hover:text-sloppy-dark/70'
                      }`}
                      onClick={() => setActiveTab(tab)}
                      whileTap={{ scale: 0.97 }}
                    >
                      {tab === 'create' ? '✨ Create' : '🚪 Join'}
                    </motion.button>
                  ))}
                </div>

                {/* Tab content with cross-fade */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{
                      opacity: 0,
                      x: activeTab === 'create' ? -20 : 20,
                    }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{
                      opacity: 0,
                      x: activeTab === 'create' ? 20 : -20,
                    }}
                    transition={{ duration: 0.2 }}
                  >
                    {activeTab === 'create' ? <CreateTab /> : <JoinTab />}
                  </motion.div>
                </AnimatePresence>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
