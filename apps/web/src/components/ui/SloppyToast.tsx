import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState, useCallback, useRef } from 'react';

type ToastType = 'success' | 'error' | 'info';

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

const icons: Record<ToastType, string> = {
  success: '🎉',
  error: '💥',
  info: '💡',
};

const bgColors: Record<ToastType, string> = {
  success: 'bg-sloppy-lime',
  error: 'bg-sloppy-pink',
  info: 'bg-sloppy-cyan',
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
              pointer-events-auto px-5 py-3 rounded-wobbly
              shadow-lg text-sloppy-dark font-bold
              flex items-center gap-2
              ${bgColors[t.type]}
            `}
            initial={{ x: 120, opacity: 0, rotate: 5 }}
            animate={{ x: 0, opacity: 1, rotate: 0 }}
            exit={{ x: 120, opacity: 0, rotate: -5 }}
            transition={{ type: 'spring', stiffness: 350, damping: 25 }}
          >
            <span className="text-xl">{icons[t.type]}</span>
            {t.message}
            {t.action && (
              <motion.button
                className="ml-2 cursor-pointer px-3 py-1 text-sm bg-white/30 rounded-wobbly hover:bg-white/50 transition-colors"
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
