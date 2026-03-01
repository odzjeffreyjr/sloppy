import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useGenerationStore } from '../stores/generation';
import { useAuthStore } from '../stores/auth';
import { useUIStore } from '../stores/ui';
import { useLobbyMusic } from '../hooks/useLobbyMusic';
import { SloppyButton } from '../components/ui/SloppyButton';
import { SloppySpinner } from '../components/ui/SloppySpinner';
import { SloppyModal } from '../components/ui/SloppyModal';
import { toast } from '../components/ui/SloppyToast';
import { gamesApi, type GameFeedItem } from '../lib/api';

const CDN_URL = import.meta.env.VITE_CDN_URL ?? '';
const MAX_PROMPT_LENGTH = 500;

const EXAMPLE_PROMPTS = [
  'Space shooter with power-ups',
  'Snake but everything is wobbly',
  'Two-player pong battle',
  'Endless runner with a twist',
  'Puzzle platformer with gravity flips',
  'Typing speed racer',
];

const PHASES = [
  { key: 'concept' as const, label: 'Concept', icon: '💡' },
  { key: 'code' as const, label: 'Code', icon: '⚡' },
  { key: 'assets' as const, label: 'Assets', icon: '🎨' },
  { key: 'multiplayer' as const, label: 'Multiplayer', icon: '👥', optional: true },
  { key: 'music' as const, label: 'Music', icon: '🎵', optional: true },
] as const;

const PHASE_KEYS = PHASES.map((p) => p.key);

const PHASE_DURATIONS: Record<string, number> = {
  concept: 5,
  code: 20,
  assets: 10,
  multiplayer: 5,
  music: 5,
};

function buildIframeSrc(game: GameFeedItem): string {
  if (game.storagePath) return `${CDN_URL}/${game.storagePath}/index.html`;
  return `${CDN_URL}/games/${game.id}/v${game.version}/index.html`;
}

function getPhaseIndex(phase: string): number {
  return PHASE_KEYS.indexOf(phase as (typeof PHASE_KEYS)[number]);
}

function estimateTimeRemaining(currentPhase: string): number {
  const idx = getPhaseIndex(currentPhase);
  if (idx === -1) return 0;
  let remaining = 0;
  for (let i = idx; i < PHASE_KEYS.length; i++) {
    remaining += PHASE_DURATIONS[PHASE_KEYS[i]] ?? 5;
  }
  return remaining;
}

// ── Confetti Celebration ─────────────────────────────────────────────

function ConfettiCelebration({ onComplete }: { onComplete: () => void }) {
  const particles = useMemo(
    () =>
      Array.from({ length: 50 }, (_, i) => ({
        id: i,
        color: ['bg-sloppy-pink', 'bg-sloppy-lime', 'bg-sloppy-cyan', 'bg-sloppy-yellow'][i % 4],
        x: (Math.random() - 0.5) * 700,
        y: -(Math.random() * 300 + 200),
        rotate: Math.random() * 720 - 360,
        scale: Math.random() * 0.6 + 0.4,
        delay: Math.random() * 0.4,
        size: Math.random() > 0.5 ? 'w-3 h-3' : 'w-2 h-2',
      })),
    [],
  );

  useEffect(() => {
    const t = setTimeout(onComplete, 3000);
    return () => clearTimeout(t);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-50 pointer-events-none overflow-hidden">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className={`absolute rounded-full ${p.color} ${p.size}`}
          style={{ left: '50%', top: '40%' }}
          initial={{ x: 0, y: 0, opacity: 1, scale: 0 }}
          animate={{
            x: p.x,
            y: [p.y, p.y + 900],
            opacity: [1, 1, 0],
            scale: p.scale,
            rotate: p.rotate,
          }}
          transition={{ duration: 2.8, delay: p.delay, ease: [0.22, 0.61, 0.36, 1] }}
        />
      ))}
    </div>
  );
}

// ── Phase Step ────────────────────────────────────────────────────────

type PhaseState = 'pending' | 'active' | 'completed';

function PhaseStep({
  icon,
  label,
  optional,
  state,
  message,
}: {
  icon: string;
  label: string;
  optional?: boolean;
  state: PhaseState;
  message?: string;
}) {
  return (
    <motion.div
      className={`flex items-center gap-4 py-3 px-4 rounded-wobbly transition-colors ${
        state === 'active' ? 'bg-white shadow-md' : ''
      }`}
      initial={false}
      animate={{ opacity: state === 'pending' ? 0.4 : 1, x: state === 'active' ? 4 : 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
    >
      <div className="w-10 h-10 flex items-center justify-center">
        {state === 'completed' && (
          <motion.div
            className="w-8 h-8 rounded-full bg-sloppy-lime flex items-center justify-center text-sloppy-dark font-bold"
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
          >
            ✓
          </motion.div>
        )}
        {state === 'active' && <SloppySpinner size={32} />}
        {state === 'pending' && (
          <div className="w-8 h-8 rounded-full border-2 border-dashed border-sloppy-dark/20 flex items-center justify-center text-lg">
            {icon}
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={`font-heading text-lg ${state === 'active' ? 'text-sloppy-dark' : 'text-sloppy-dark/60'}`}
          >
            {icon} {label}
          </span>
          {optional && <span className="text-xs text-sloppy-dark/30 font-body">optional</span>}
        </div>
        {state === 'active' && message && (
          <motion.p
            className="text-sm text-sloppy-dark/50 truncate"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            key={message}
          >
            {message}
          </motion.p>
        )}
      </div>
    </motion.div>
  );
}

// ── Refinement Panel ─────────────────────────────────────────────────

interface RefinementMessage {
  role: 'user' | 'system';
  content: string;
}

function RefinementPanel({
  history,
  onSend,
  onClose,
}: {
  history: RefinementMessage[];
  onSend: (msg: string) => void;
  onClose: () => void;
}) {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [history.length]);

  const handleSend = () => {
    if (!input.trim()) return;
    onSend(input.trim());
    setInput('');
  };

  return (
    <motion.div
      className="w-full lg:w-80 shrink-0 bg-white rounded-wobbly-lg border-2 border-dashed border-sloppy-dark/10 flex flex-col"
      style={{ maxHeight: '70vh', minHeight: '300px' }}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
    >
      <div className="p-4 border-b border-sloppy-dark/5 flex items-center justify-between shrink-0">
        <h3 className="font-heading text-lg text-sloppy-dark">Refine</h3>
        <motion.button
          className="cursor-pointer text-sloppy-dark/40 hover:text-sloppy-dark text-lg"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={onClose}
        >
          ✕
        </motion.button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {history.length === 0 && (
          <p className="text-sm text-sloppy-dark/30 text-center py-8">
            Tell the AI what to change — &quot;Make it faster&quot;, &quot;Add enemies&quot;,
            &quot;Change colors&quot;
          </p>
        )}
        {history.map((msg, i) => (
          <motion.div
            key={i}
            className={`p-3 rounded-wobbly text-sm ${
              msg.role === 'user'
                ? 'bg-sloppy-pink/10 text-sloppy-dark ml-4'
                : 'bg-sloppy-cyan/10 text-sloppy-dark mr-4'
            }`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {msg.content}
          </motion.div>
        ))}
      </div>

      <div className="p-4 border-t border-sloppy-dark/5 shrink-0">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Describe a change..."
            className="flex-1 px-3 py-2 text-sm bg-sloppy-cream rounded-wobbly border border-sloppy-dark/10 outline-none focus:border-sloppy-pink transition-colors"
          />
          <SloppyButton
            onClick={handleSend}
            disabled={!input.trim()}
            className={`!px-3 !py-2 !text-sm ${!input.trim() ? 'opacity-50' : ''}`}
          >
            Send
          </SloppyButton>
        </div>
      </div>
    </motion.div>
  );
}

// ── Main Create Page ─────────────────────────────────────────────────

export default function Create() {
  const navigate = useNavigate();
  const {
    status,
    phase,
    progress,
    message,
    error,
    gameId,
    gameTitle,
    gameDescription,
    prompt: storedPrompt,
    startGeneration,
    disconnect,
    reset,
  } = useGenerationStore();

  const { isAuthenticated, login } = useAuthStore();
  const { openGameOverlay } = useUIStore();

  useLobbyMusic(status === 'generating');

  const [prompt, setPrompt] = useState(storedPrompt || '');
  const [game, setGame] = useState<GameFeedItem | null>(null);
  const [isIframeLoading, setIsIframeLoading] = useState(true);
  const [showRefinement, setShowRefinement] = useState(false);
  const [refinementHistory, setRefinementHistory] = useState<RefinementMessage[]>([]);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isPublished, setIsPublished] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Fetch game data when generation completes
  useEffect(() => {
    if (status === 'done' && gameId && !game) {
      gamesApi
        .get(gameId)
        .then((res) => setGame(res.data))
        .catch(() => {});
    }
  }, [status, gameId, game]);

  // Cleanup EventSource on unmount
  useEffect(() => {
    return () => disconnect();
  }, [disconnect]);

  // Auto-focus textarea when idle
  useEffect(() => {
    if (status === 'idle') textareaRef.current?.focus();
  }, [status]);

  // postMessage handler + timeout fallback for iframe loading
  useEffect(() => {
    if (status !== 'done') return;
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'sloppy:game:ready') setIsIframeLoading(false);
    };
    window.addEventListener('message', handler);
    const timeout = setTimeout(() => setIsIframeLoading(false), 10_000);
    return () => {
      window.removeEventListener('message', handler);
      clearTimeout(timeout);
    };
  }, [status]);

  const handleGenerate = useCallback(() => {
    const text = prompt.trim();
    if (!text) return;
    setGame(null);
    setIsIframeLoading(true);
    setIsPublished(false);
    startGeneration(text);
  }, [prompt, startGeneration]);

  const handleExampleClick = useCallback((example: string) => {
    setPrompt(example);
    textareaRef.current?.focus();
  }, []);

  const handleRetry = useCallback(() => {
    const text = prompt.trim();
    if (text) {
      setGame(null);
      setIsIframeLoading(true);
      startGeneration(text);
    } else {
      reset();
    }
  }, [prompt, startGeneration, reset]);

  const handleNewGame = useCallback(() => {
    reset();
    setGame(null);
    setPrompt('');
    setIsIframeLoading(true);
    setShowRefinement(false);
    setRefinementHistory([]);
    setIsPublished(false);
  }, [reset]);

  const handleSave = useCallback(async () => {
    if (!isAuthenticated) {
      setShowAuthModal(true);
      return;
    }
    if (!gameId) return;
    setIsSaving(true);
    try {
      await gamesApi.saveDraft(gameId);
      toast('Game saved as draft!', 'success');
    } catch {
      toast('Failed to save game', 'error');
    } finally {
      setIsSaving(false);
    }
  }, [isAuthenticated, gameId]);

  const handlePublish = useCallback(async () => {
    if (!isAuthenticated) {
      setShowAuthModal(true);
      return;
    }
    if (!gameId) return;
    setIsPublishing(true);
    try {
      await gamesApi.publish(gameId);
      setShowConfetti(true);
      setIsPublished(true);
      toast('Game published to the feed!', 'success');
    } catch {
      toast('Failed to publish game', 'error');
    } finally {
      setIsPublishing(false);
    }
  }, [isAuthenticated, gameId]);

  const handleRefinement = useCallback(
    (instruction: string) => {
      setRefinementHistory((prev) => [...prev, { role: 'user', content: instruction }]);
      const refinedPrompt = `Original game: ${prompt}\n\nRefinement: ${instruction}`;
      setGame(null);
      setIsIframeLoading(true);
      startGeneration(refinedPrompt);
      setRefinementHistory((prev) => [
        ...prev,
        { role: 'system', content: 'Regenerating with your changes...' },
      ]);
    },
    [prompt, startGeneration],
  );

  const handleLogin = useCallback(
    async (method: 'google' | 'anonymous') => {
      await login(method);
      setShowAuthModal(false);
    },
    [login],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleGenerate();
    },
    [handleGenerate],
  );

  const getPhaseState = useCallback(
    (phaseKey: string): PhaseState => {
      if (status === 'done') return 'completed';
      const currentIdx = getPhaseIndex(phase);
      const thisIdx = getPhaseIndex(phaseKey);
      if (thisIdx < currentIdx) return 'completed';
      if (thisIdx === currentIdx) return 'active';
      return 'pending';
    },
    [status, phase],
  );

  const timeRemaining = status === 'generating' ? estimateTimeRemaining(phase) : 0;

  return (
    <motion.div
      className="max-w-4xl mx-auto"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {showConfetti && <ConfettiCelebration onComplete={() => setShowConfetti(false)} />}

      <AnimatePresence mode="wait">
        {/* ── IDLE / ERROR: Prompt Input ── */}
        {(status === 'idle' || status === 'error') && (
          <motion.div
            key="prompt-input"
            className="flex flex-col items-center gap-6 pt-8 md:pt-16"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          >
            <div className="text-center space-y-2">
              <h1 className="font-heading text-4xl md:text-5xl text-sloppy-dark">
                Create a Game
              </h1>
              <p className="text-sloppy-dark/50 text-lg max-w-md mx-auto">
                Describe your game idea and watch AI build it in real time
              </p>
            </div>

            {/* Textarea */}
            <div className="w-full max-w-2xl">
              <motion.textarea
                ref={textareaRef}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value.slice(0, MAX_PROMPT_LENGTH))}
                onKeyDown={handleKeyDown}
                placeholder="Describe your game... (e.g., 'A platformer where you're a cat jumping on clouds')"
                className="w-full h-40 px-5 py-4 text-lg font-body bg-white rounded-wobbly-lg border-2 border-dashed border-sloppy-dark/20 outline-none ring-0 focus:ring-4 focus:ring-sloppy-pink/40 focus:border-sloppy-pink transition-colors placeholder:text-sloppy-dark/30 resize-none"
                whileFocus={{ scale: 1.01 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
              <div className="flex justify-between items-center mt-2 px-1">
                <span className="text-sm text-sloppy-dark/30">
                  {prompt.length}/{MAX_PROMPT_LENGTH}
                </span>
                <span className="text-sm text-sloppy-dark/30">⌘+Enter to generate</span>
              </div>
            </div>

            {/* Example prompts */}
            <div className="w-full max-w-2xl">
              <p className="text-sm text-sloppy-dark/40 mb-3 font-heading">
                Or try one of these:
              </p>
              <div className="flex flex-wrap gap-2">
                {EXAMPLE_PROMPTS.map((example) => (
                  <motion.button
                    key={example}
                    className="cursor-pointer px-4 py-2 bg-white rounded-wobbly border-2 border-dashed border-sloppy-dark/10 text-sm text-sloppy-dark/70 font-body hover:border-sloppy-pink/40 hover:text-sloppy-dark transition-colors"
                    whileHover={{ scale: 1.05, rotate: [-1, 1, 0] }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleExampleClick(example)}
                  >
                    {example}
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Error message */}
            {status === 'error' && error && (
              <motion.div
                className="w-full max-w-2xl bg-red-50 border-2 border-red-200 rounded-wobbly p-4"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <div className="flex items-start gap-3">
                  <span className="text-3xl">😵</span>
                  <div className="flex-1">
                    <p className="font-heading text-red-800 text-lg">Something went wrong</p>
                    <p className="text-red-600 text-sm mt-1">{error}</p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Generate / Retry button */}
            <SloppyButton
              onClick={status === 'error' ? handleRetry : handleGenerate}
              disabled={!prompt.trim()}
              className={`text-xl px-10 py-4 ${!prompt.trim() ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {status === 'error' ? '🔄 Try Again' : '🎮 Generate Game'}
            </SloppyButton>
          </motion.div>
        )}

        {/* ── GENERATING: Progress UI ── */}
        {status === 'generating' && (
          <motion.div
            key="progress"
            className="flex flex-col items-center gap-8 pt-8 md:pt-16"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          >
            <div className="text-center space-y-2">
              <motion.h2
                className="font-heading text-3xl md:text-4xl text-sloppy-dark"
                animate={{ rotate: [-1, 1, -1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                Building your game...
              </motion.h2>
              {gameTitle && (
                <motion.p
                  className="font-heading text-xl text-sloppy-pink"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  &ldquo;{gameTitle}&rdquo;
                </motion.p>
              )}
            </div>

            {/* Progress bar */}
            <div className="w-full max-w-md">
              <div className="h-3 bg-sloppy-dark/10 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-sloppy-pink via-sloppy-cyan to-sloppy-lime rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ type: 'spring', stiffness: 100, damping: 20 }}
                />
              </div>
              <div className="flex justify-between mt-2">
                <span className="text-sm text-sloppy-dark/40">{progress}%</span>
                <span className="text-sm text-sloppy-dark/40">~{timeRemaining}s remaining</span>
              </div>
            </div>

            {/* Phase steps */}
            <div className="w-full max-w-md space-y-1">
              {PHASES.map((p) => (
                <PhaseStep
                  key={p.key}
                  icon={p.icon}
                  label={p.label}
                  optional={'optional' in p ? p.optional : undefined}
                  state={getPhaseState(p.key)}
                  message={phase === p.key ? message : undefined}
                />
              ))}
            </div>

            {/* Live status message */}
            {message && (
              <motion.p
                className="text-sloppy-dark/50 text-center max-w-sm"
                key={message}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                {message}
              </motion.p>
            )}
          </motion.div>
        )}

        {/* ── DONE: Game Preview + Actions ── */}
        {status === 'done' && (
          <motion.div
            key="preview"
            className="pt-4 md:pt-8"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          >
            {/* Title & description */}
            <div className="text-center mb-6 space-y-1">
              <h2 className="font-heading text-3xl text-sloppy-dark">
                {game?.title ?? gameTitle ?? 'Your Game'}
              </h2>
              <p className="text-sloppy-dark/50 max-w-lg mx-auto">
                {game?.description ?? gameDescription ?? ''}
              </p>
            </div>

            {/* Game preview + refinement layout */}
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Game iframe */}
              <div
                className="flex-1 relative bg-sloppy-dark rounded-wobbly-lg overflow-hidden"
                style={{ minHeight: '400px', maxHeight: '70vh' }}
              >
                {isIframeLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-sloppy-dark z-10">
                    <div className="flex flex-col items-center gap-4">
                      <SloppySpinner size={48} />
                      <span className="font-heading text-white/60">Loading game...</span>
                    </div>
                  </div>
                )}
                {game && (
                  <iframe
                    ref={iframeRef}
                    src={buildIframeSrc(game)}
                    sandbox="allow-scripts"
                    title={game.title}
                    className="w-full h-full border-none"
                    style={{ minHeight: '400px' }}
                    onLoad={() => setIsIframeLoading(false)}
                  />
                )}
              </div>

              {/* Refinement panel */}
              <AnimatePresence>
                {showRefinement && (
                  <RefinementPanel
                    history={refinementHistory}
                    onSend={handleRefinement}
                    onClose={() => setShowRefinement(false)}
                  />
                )}
              </AnimatePresence>
            </div>

            {/* Action bar */}
            <motion.div
              className="flex flex-wrap items-center justify-center gap-3 mt-6 pb-8"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              {game && (
                <SloppyButton variant="ghost" onClick={() => openGameOverlay(game.id, game)}>
                  🔲 Fullscreen
                </SloppyButton>
              )}

              {!showRefinement && (
                <SloppyButton variant="ghost" onClick={() => setShowRefinement(true)}>
                  ✏️ Refine
                </SloppyButton>
              )}

              <SloppyButton variant="ghost" onClick={handleSave} disabled={isSaving}>
                {isSaving ? 'Saving...' : '💾 Save as Draft'}
              </SloppyButton>

              {!isPublished ? (
                <SloppyButton onClick={handlePublish} disabled={isPublishing}>
                  {isPublishing ? 'Publishing...' : '🎉 Publish to Feed'}
                </SloppyButton>
              ) : (
                <SloppyButton variant="secondary" onClick={() => navigate('/')}>
                  🏠 View in Feed
                </SloppyButton>
              )}

              <SloppyButton variant="ghost" onClick={handleNewGame}>
                ✨ New Game
              </SloppyButton>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Auth Gate Modal */}
      <SloppyModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        title="Sign in to continue"
      >
        <p className="text-sloppy-dark/60 mb-6">
          Create an account to save and publish your games.
        </p>
        <div className="flex flex-col gap-3">
          <SloppyButton onClick={() => handleLogin('google')} className="w-full">
            Sign in with Google
          </SloppyButton>
          <SloppyButton
            variant="ghost"
            onClick={() => handleLogin('anonymous')}
            className="w-full"
          >
            Continue as Guest
          </SloppyButton>
        </div>
      </SloppyModal>
    </motion.div>
  );
}
