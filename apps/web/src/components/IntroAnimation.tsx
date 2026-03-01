import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useUIStore } from '../stores/ui';

export function IntroAnimation() {
  const { hasSeenIntro, markIntroSeen } = useUIStore();
  const [show, setShow] = useState(!hasSeenIntro);

  useEffect(() => {
    if (!show) return;
    const timer = setTimeout(() => {
      setShow(false);
      markIntroSeen();
    }, 2000);
    return () => clearTimeout(timer);
  }, [show, markIntroSeen]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-[200] bg-sloppy-cream flex items-center justify-center"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
        >
          <motion.div className="flex flex-col items-center gap-4">
            <motion.h1
              className="font-heading text-7xl md:text-9xl text-sloppy-pink select-none"
              initial={{ scale: 0.2, rotate: -15, opacity: 0 }}
              animate={{
                scale: [0.2, 1.15, 0.95, 1.05, 1],
                rotate: [-15, 8, -4, 2, 0],
                opacity: 1,
              }}
              transition={{ duration: 1, ease: 'easeOut' }}
            >
              sloppy
            </motion.h1>

            {/* bouncing dots */}
            <div className="flex gap-3">
              {['bg-sloppy-pink', 'bg-sloppy-cyan', 'bg-sloppy-lime', 'bg-sloppy-yellow'].map(
                (color, i) => (
                  <motion.div
                    key={i}
                    className={`w-4 h-4 rounded-full ${color}`}
                    initial={{ y: 0 }}
                    animate={{ y: [0, -16, 0] }}
                    transition={{
                      duration: 0.5,
                      repeat: 3,
                      delay: 0.8 + i * 0.1,
                    }}
                  />
                ),
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
