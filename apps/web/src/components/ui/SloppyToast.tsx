import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState, useCallback, useRef } from 'react';

type ToastType = 'success' | 'error' | 'info' | 'primary';

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  action?: ToastAction;
}

interface ToastOptions {
  type?: ToastType;
  action?: ToastAction;
  duration?: number;
}

const borderColors: Record<ToastType, string> = {
  success: 'border-l-sloppy-success',
  error: 'border-l-sloppy-danger',
  info: 'border-l-sloppy-secondary',
  primary: 'border-l-sloppy-primary',
};

const iconColors: Record<ToastType, string> = {
  success: 'text-sloppy-success',
  error: 'text-sloppy-danger',
  info: 'text-sloppy-secondary',
  primary: 'text-sloppy-primary',
};

let addToastFn: ((message: string, options?: ToastOptions) => void) | null = null;

export function toast(message: string, typeOrOptions: ToastType | ToastOptions = 'info') {
  const options: ToastOptions =
    typeof typeOrOptions === 'string' ? { type: typeOrOptions } : typeOrOptions;
  addToastFn?.(message, options);
}

export function SloppyToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const addToast = useCallback(
    (message: string, options: ToastOptions = {}) => {
      const id = Math.random().toString(36).slice(2, 9);
      const { type = 'info', action, duration = action ? 5000 : 3500 } = options;
      setToasts((prev) => [...prev, { id, message, type, action }]);
      const timer = setTimeout(() => {
        dismiss(id);
      }, duration);
      timers.current.set(id, timer);
    },
    [dismiss],
  );

  useEffect(() => {
    addToastFn = addToast;
    return () => {
      addToastFn = null;
    };
  }, [addToast]);

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-3 pointer-events-none">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            className={`
              pointer-events-auto px-4 py-3 rounded-wobbly
              bg-sloppy-surface border border-sloppy-border border-l-4
              shadow-xl text-sloppy-text text-sm font-medium
              flex items-center gap-3
              ${borderColors[t.type]}
            `}
            initial={{ x: 120, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 120, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 350, damping: 25 }}
          >
            <ToastIcon type={t.type} className={iconColors[t.type]} />
            <span className="flex-1">{t.message}</span>
            {t.action && (
              <motion.button
                className="ml-1 cursor-pointer px-3 py-1 text-xs bg-sloppy-surface-hover rounded-full hover:bg-sloppy-primary/20 text-sloppy-text transition-colors border-0"
                whileTap={{ scale: 0.9 }}
                onClick={() => {
                  t.action!.onClick();
                  dismiss(t.id);
                }}
              >
                {t.action.label}
              </motion.button>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function ToastIcon({ type, className }: { type: ToastType; className?: string }) {
  if (type === 'success') {
    return (
      <svg className={`w-5 h-5 shrink-0 ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6L9 17l-5-5" />
      </svg>
    );
  }
  if (type === 'error') {
    return (
      <svg className={`w-5 h-5 shrink-0 ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M15 9l-6 6M9 9l6 6" />
      </svg>
    );
  }
  if (type === 'primary') {
    return (
      <svg className={`w-5 h-5 shrink-0 ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6L9 17l-5-5" />
      </svg>
    );
  }
  return (
    <svg className={`w-5 h-5 shrink-0 ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </svg>
  );
}
