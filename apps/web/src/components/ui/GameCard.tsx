import { motion } from 'framer-motion';
import { useMemo, useCallback } from 'react';
import type { GameFeedItem } from '../../lib/api';

interface GameCardProps {
  game: GameFeedItem;
  onPlay: (game: GameFeedItem) => void;
  onFavourite: (gameId: string) => void;
  onUnfavourite: (gameId: string) => void;
}

export function GameCard({ game, onPlay, onFavourite, onUnfavourite }: GameCardProps) {
  const rotation = useMemo(() => Math.random() * 2.5 - 1.25, []);

  const handleFavouriteClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      game.isFavourited ? onUnfavourite(game.id) : onFavourite(game.id);
    },
    [game.id, game.isFavourited, onFavourite, onUnfavourite],
  );

  return (
    <motion.div
      className="bg-white rounded-wobbly-lg p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)] border-2 border-sloppy-dark/5 flex flex-col gap-3 cursor-pointer select-none"
      style={{ rotate: rotation }}
      whileHover={{
        y: -8,
        rotate: 0,
        boxShadow: '6px 10px 0px 0px rgba(0,0,0,0.12)',
      }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      onClick={() => onPlay(game)}
      tabIndex={0}
      role="button"
      aria-label={`Play ${game.title}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onPlay(game);
        }
      }}
    >
      {/* title + favourite */}
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-heading text-xl text-sloppy-dark leading-tight">
          {game.title}
        </h3>
        <motion.button
          className="text-2xl cursor-pointer shrink-0"
          whileHover={{ scale: 1.3 }}
          whileTap={{ scale: 0.8 }}
          onClick={handleFavouriteClick}
          aria-label={game.isFavourited ? 'Unfavourite' : 'Favourite'}
        >
          {game.isFavourited ? '❤️' : '🤍'}
        </motion.button>
      </div>

      {/* description */}
      {game.description && (
        <p className="text-sm text-sloppy-dark/60 line-clamp-2">{game.description}</p>
      )}

      {/* footer */}
      <div className="flex items-center justify-between mt-auto pt-2">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-sloppy-dark/40 font-medium">
            🎮 {game.playCount.toLocaleString()} plays
          </span>
          {game.creatorDisplayName && (
            <span className="text-xs text-sloppy-dark/35 font-medium">
              by {game.creatorDisplayName}
            </span>
          )}
        </div>

        <motion.button
          className="cursor-pointer px-4 py-2 bg-sloppy-pink text-white text-sm font-bold rounded-wobbly shadow-md shadow-sloppy-pink/20"
          whileHover={{ scale: 1.08, rotate: -1 }}
          whileTap={{ scale: 0.95 }}
          onClick={(e) => {
            e.stopPropagation();
            onPlay(game);
          }}
        >
          Play
        </motion.button>
      </div>
    </motion.div>
  );
}
