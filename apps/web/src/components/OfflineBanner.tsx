import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import { WifiOff } from 'lucide-react';

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <AnimatePresence>
      {isOffline && (
        <motion.div
          className="fixed top-0 left-0 right-0 z-[200] bg-sloppy-warning text-sloppy-bg text-center py-2 px-4 font-bold text-sm shadow-md"
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -50, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        >
          <span className="inline-flex items-center gap-2"><WifiOff size={18} /> You're offline — some features won't work</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
