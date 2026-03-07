import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Gamepad2 } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (localStorage.getItem('sloppy-pwa-dismissed')) {
      setDismissed(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    setDeferredPrompt(null);
    localStorage.setItem('sloppy-pwa-dismissed', '1');
  }, []);

  const show = deferredPrompt && !dismissed;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed bottom-20 left-4 right-4 z-[100] mx-auto max-w-md rounded-wobbly bg-sloppy-surface border border-sloppy-border shadow-lg p-4 flex items-center gap-3"
          initial={{ y: 100, opacity: 0, scale: 0.9 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 100, opacity: 0, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        >
          <div className="shrink-0 text-sloppy-primary"><Gamepad2 size={32} /></div>
          <div className="flex-1 min-w-0">
            <p className="font-heading text-lg text-sloppy-text leading-tight">
              Install Sloppy
            </p>
            <p className="text-sm text-sloppy-text-muted leading-snug">
              Add to your home screen for quick access
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={handleDismiss}
              className="text-sm text-sloppy-text-muted hover:text-sloppy-text transition-colors px-2 py-1"
            >
              Later
            </button>
            <button
              onClick={handleInstall}
              className="bg-sloppy-primary text-white font-heading text-sm px-4 py-2 rounded-full hover:scale-105 active:scale-95 transition-transform"
            >
              Install
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
