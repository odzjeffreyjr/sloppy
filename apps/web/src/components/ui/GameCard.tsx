import { motion } from 'framer-motion';
import { useCallback, useRef } from 'react';
import type { GameFeedItem } from '../../lib/api';

interface GameCardProps {
  game: GameFeedItem;
  onPlay: (game: GameFeedItem) => void;
  onFavourite: (gameId: string) => void;
  onUnfavourite: (gameId: string) => void;
}

const genreLabels: Record<string, string> = {
  '2d-platformer': 'Platformer',
  '2d-topdown': 'Top-Down',
  '2d-puzzle': 'Puzzle',
  '2d-arcade': 'Arcade',
  '2d-shooter': 'Shooter',
  '2d-tower-defense': 'Tower Defense',
  '2d-endless-runner': 'Runner',
  '2d-rhythm': 'Rhythm',
  '2d-cards': 'Cards',
  '2d-idle': 'Idle',
  '3d-racing': 'Racing',
  '3d-firstperson': 'FPS',
  '3d-puzzle': '3D Puzzle',
  '3d-thirdperson': '3D Runner',
  '3d-flight': 'Flight',
  '3d-platformer': '3D Platformer',
  '2d-custom': '2D',
  '3d-custom': '3D',
};

const engineLabels: Record<string, string> = {
  phaser3: 'Phaser 3',
  threejs: 'Three.js',
  canvas2d: 'Canvas',
};

export function GameCard({ game, onPlay, onFavourite, onUnfavourite }: GameCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  const handleFavouriteClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      game.isFavourited ? onUnfavourite(game.id) : onFavourite(game.id);
    },
    [game.id, game.isFavourited, onFavourite, onUnfavourite],
  );

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    cardRef.current.style.transform = `perspective(800px) rotateX(${-y * 5}deg) rotateY(${x * 5}deg)`;
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (cardRef.current) {
      cardRef.current.style.transform = 'perspective(800px) rotateX(0deg) rotateY(0deg)';
    }
  }, []);

  const genre = (game as any).genre;
  const engine = (game as any).engine;
  const thumbnailSmUrl = (game as any).thumbnailSmUrl;
  const thumbnailUrl = (game as any).thumbnailUrl;
  const favouriteCount = (game as any).favouriteCount ?? 0;
  const thumb = thumbnailSmUrl || thumbnailUrl;

  return (
    <motion.div
      ref={cardRef}
      className="group bg-sloppy-surface rounded-wobbly-lg overflow-hidden border border-sloppy-border cursor-pointer select-none transition-[transform,box-shadow] duration-200 ease-out hover:border-sloppy-primary/30 hover:shadow-xl hover:shadow-sloppy-primary/10"
      style={{ transformStyle: 'preserve-3d' }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
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
      {/* thumbnail */}
      <div className="relative aspect-video bg-sloppy-surface-hover overflow-hidden">
        {thumb ? (
          <img
            src={thumb}
            alt={game.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <GamepadIcon className="w-12 h-12 text-sloppy-text-muted/20" />
          </div>
        )}

        {/* play overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-200 flex items-center justify-center">
          <motion.div
            className="w-12 h-12 rounded-full bg-sloppy-primary/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 shadow-lg shadow-sloppy-primary/30"
            whileHover={{ scale: 1.1 }}
          >
            <svg className="w-5 h-5 text-white ml-0.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </motion.div>
        </div>

        {/* badges */}
        <div className="absolute top-2 left-2 flex gap-1.5">
          {genre && genreLabels[genre] && (
            <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-sloppy-primary/80 text-white backdrop-blur-sm">
              {genreLabels[genre]}
            </span>
          )}
          {engine && engineLabels[engine] && (
            <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-sloppy-secondary/80 text-white backdrop-blur-sm">
              {engineLabels[engine]}
            </span>
          )}
        </div>
      </div>

      {/* info */}
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-heading text-base text-sloppy-text leading-tight line-clamp-1">
            {game.title}
          </h3>
          <motion.button
            className="text-lg cursor-pointer shrink-0 bg-transparent border-0 p-0"
            whileHover={{ scale: 1.3 }}
            whileTap={{ scale: 0.8 }}
            onClick={handleFavouriteClick}
            aria-label={game.isFavourited ? 'Unfavourite' : 'Favourite'}
          >
            <HeartSmIcon filled={game.isFavourited} />
          </motion.button>
        </div>

        <div className="flex items-center gap-3 mt-2 text-xs text-sloppy-text-muted">
          <span className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <circle cx="12" cy="12" r="10" />
            </svg>
            {game.playCount.toLocaleString()}
          </span>
          {favouriteCount > 0 && (
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
              </svg>
              {favouriteCount.toLocaleString()}
            </span>
          )}
          {game.creatorDisplayName && (
            <span className="ml-auto truncate">
              {game.creatorDisplayName}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function HeartSmIcon({ filled }: { filled: boolean }) {
  return (
    <svg className={`w-4.5 h-4.5 ${filled ? 'text-sloppy-danger' : 'text-sloppy-text-muted'}`} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2}>
      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
    </svg>
  );
}

function GamepadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="6" width="20" height="12" rx="4" />
      <path d="M6 12h4M8 10v4" />
      <circle cx="16" cy="10" r="1" fill="currentColor" />
      <circle cx="18" cy="12" r="1" fill="currentColor" />
    </svg>
  );
}
