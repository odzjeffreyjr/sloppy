import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useCallback } from 'react';
import type { GameFeedItem } from '../../lib/api';

interface HeroBannerProps {
  games: GameFeedItem[];
  onPlay: (game: GameFeedItem) => void;
  rotationInterval?: number;
}

export function HeroBanner({ games, onPlay, rotationInterval = 6000 }: HeroBannerProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (games.length <= 1) return;
    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % games.length);
    }, rotationInterval);
    return () => clearInterval(timer);
  }, [games.length, rotationInterval]);

  const handleDotClick = useCallback((index: number) => {
    setActiveIndex(index);
  }, []);

  if (games.length === 0) return null;

  const game = games[activeIndex];
  const thumbnailUrl = (game as any).thumbnailUrl || (game as any).thumbnailSmUrl;

  return (
    <div className="relative w-full aspect-[21/9] md:aspect-[3/1] rounded-wobbly-lg overflow-hidden bg-sloppy-surface border border-sloppy-border">
      <AnimatePresence mode="wait">
        <motion.div
          key={game.id}
          className="absolute inset-0"
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.5 }}
        >
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt={game.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-sloppy-primary/30 to-sloppy-secondary/30" />
          )}

          {/* gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

          {/* content */}
          <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
            <motion.span
              className="inline-block px-3 py-1 text-xs font-semibold rounded-full bg-sloppy-primary/80 text-white mb-3"
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              Featured
            </motion.span>
            <motion.h2
              className="font-heading text-2xl md:text-4xl text-white leading-tight mb-2"
              initial={{ y: 15, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              {game.title}
            </motion.h2>
            {game.description && (
              <motion.p
                className="text-sm md:text-base text-white/70 line-clamp-2 max-w-lg mb-4"
                initial={{ y: 15, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                {game.description}
              </motion.p>
            )}
            <motion.button
              className="cursor-pointer inline-flex items-center gap-2 px-6 py-2.5 bg-sloppy-primary text-white text-sm font-semibold rounded-wobbly shadow-lg shadow-sloppy-primary/30 hover:shadow-sloppy-primary/50 transition-shadow border-0"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={(e) => {
                e.stopPropagation();
                onPlay(game);
              }}
              initial={{ y: 15, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
              Play Now
            </motion.button>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* dots */}
      {games.length > 1 && (
        <div className="absolute bottom-3 right-4 md:right-6 flex gap-1.5">
          {games.map((_, i) => (
            <button
              key={i}
              className={`cursor-pointer w-2 h-2 rounded-full border-0 transition-all ${
                i === activeIndex
                  ? 'bg-sloppy-primary w-5'
                  : 'bg-white/40 hover:bg-white/60'
              }`}
              onClick={() => handleDotClick(i)}
              aria-label={`Show featured game ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
