import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';

interface FilterBarProps {
  selectedGenre: string | null;
  selectedEngine: string | null;
  multiplayerOnly: boolean;
  sortBy: string;
  onGenreChange: (genre: string | null) => void;
  onEngineChange: (engine: string | null) => void;
  onMultiplayerChange: (multiplayer: boolean) => void;
  onSortChange: (sort: string) => void;
}

const genres = [
  { value: '2d-platformer', label: 'Platformer' },
  { value: '2d-topdown', label: 'Top-Down' },
  { value: '2d-puzzle', label: 'Puzzle' },
  { value: '2d-arcade', label: 'Arcade' },
  { value: '2d-shooter', label: 'Shooter' },
  { value: '2d-tower-defense', label: 'Tower Defense' },
  { value: '2d-endless-runner', label: 'Runner' },
  { value: '2d-rhythm', label: 'Rhythm' },
  { value: '2d-cards', label: 'Cards' },
  { value: '2d-idle', label: 'Idle' },
  { value: '3d-racing', label: 'Racing' },
  { value: '3d-firstperson', label: 'FPS' },
  { value: '3d-puzzle', label: '3D Puzzle' },
  { value: '3d-thirdperson', label: '3D Runner' },
  { value: '3d-flight', label: 'Flight' },
  { value: '3d-platformer', label: '3D Platformer' },
  { value: '2d-custom', label: 'Custom 2D' },
  { value: '3d-custom', label: 'Custom 3D' },
];

const engines = [
  { value: 'phaser3', label: 'Phaser 3' },
  { value: 'threejs', label: 'Three.js' },
  { value: 'canvas2d', label: 'Canvas 2D' },
];

const sortOptions = [
  { value: 'trending', label: 'Trending' },
  { value: 'newest', label: 'Newest' },
  { value: 'popular', label: 'Most Played' },
  { value: 'favourites', label: 'Most Liked' },
];

export function FilterBar({
  selectedGenre,
  selectedEngine,
  multiplayerOnly,
  sortBy,
  onGenreChange,
  onEngineChange,
  onMultiplayerChange,
  onSortChange,
}: FilterBarProps) {
  const [expanded, setExpanded] = useState(false);

  const activeFilterCount =
    (selectedGenre ? 1 : 0) +
    (selectedEngine ? 1 : 0) +
    (multiplayerOnly ? 1 : 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <motion.button
          className={`
            cursor-pointer inline-flex items-center gap-1.5 px-3 py-2 rounded-wobbly text-sm font-medium border transition-colors
            ${expanded
              ? 'bg-sloppy-primary/15 text-sloppy-primary border-sloppy-primary/30'
              : 'bg-sloppy-surface text-sloppy-text-muted border-sloppy-border hover:bg-sloppy-surface-hover hover:text-sloppy-text'}
          `}
          onClick={() => setExpanded((v) => !v)}
          whileTap={{ scale: 0.97 }}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
            <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
          </svg>
          Filters
          {activeFilterCount > 0 && (
            <span className="ml-0.5 px-1.5 py-0.5 text-[10px] bg-sloppy-primary text-white rounded-full">
              {activeFilterCount}
            </span>
          )}
        </motion.button>

        {/* sort dropdown */}
        <select
          value={sortBy}
          onChange={(e) => onSortChange(e.target.value)}
          className="cursor-pointer px-3 py-2 bg-sloppy-surface text-sloppy-text-muted text-sm rounded-wobbly border border-sloppy-border outline-none focus:ring-2 focus:ring-sloppy-primary/40 focus:border-sloppy-primary/40 transition-colors"
        >
          {sortOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {/* active filter pills */}
        {selectedGenre && (
          <FilterPill
            label={genres.find((g) => g.value === selectedGenre)?.label ?? selectedGenre}
            onRemove={() => onGenreChange(null)}
          />
        )}
        {selectedEngine && (
          <FilterPill
            label={engines.find((e) => e.value === selectedEngine)?.label ?? selectedEngine}
            onRemove={() => onEngineChange(null)}
          />
        )}
        {multiplayerOnly && (
          <FilterPill label="Multiplayer" onRemove={() => onMultiplayerChange(false)} />
        )}
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            className="glass rounded-wobbly-lg p-4 border border-sloppy-border space-y-4"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* genre */}
            <div>
              <label className="text-xs text-sloppy-text-muted/60 uppercase tracking-wider font-semibold mb-2 block">
                Genre
              </label>
              <div className="flex flex-wrap gap-1.5">
                {genres.map((g) => (
                  <button
                    key={g.value}
                    className={`cursor-pointer px-3 py-1.5 text-xs rounded-full border transition-colors ${
                      selectedGenre === g.value
                        ? 'bg-sloppy-primary text-white border-sloppy-primary'
                        : 'bg-transparent text-sloppy-text-muted border-sloppy-border hover:border-sloppy-primary/40 hover:text-sloppy-text'
                    }`}
                    onClick={() => onGenreChange(selectedGenre === g.value ? null : g.value)}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>

            {/* engine */}
            <div>
              <label className="text-xs text-sloppy-text-muted/60 uppercase tracking-wider font-semibold mb-2 block">
                Engine
              </label>
              <div className="flex flex-wrap gap-1.5">
                {engines.map((e) => (
                  <button
                    key={e.value}
                    className={`cursor-pointer px-3 py-1.5 text-xs rounded-full border transition-colors ${
                      selectedEngine === e.value
                        ? 'bg-sloppy-secondary text-white border-sloppy-secondary'
                        : 'bg-transparent text-sloppy-text-muted border-sloppy-border hover:border-sloppy-secondary/40 hover:text-sloppy-text'
                    }`}
                    onClick={() => onEngineChange(selectedEngine === e.value ? null : e.value)}
                  >
                    {e.label}
                  </button>
                ))}
              </div>
            </div>

            {/* multiplayer toggle */}
            <div className="flex items-center gap-2">
              <button
                className={`cursor-pointer relative w-10 h-5 rounded-full transition-colors border-0 ${
                  multiplayerOnly ? 'bg-sloppy-primary' : 'bg-sloppy-surface-hover'
                }`}
                onClick={() => onMultiplayerChange(!multiplayerOnly)}
                role="switch"
                aria-checked={multiplayerOnly}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                    multiplayerOnly ? 'translate-x-5' : ''
                  }`}
                />
              </button>
              <span className="text-sm text-sloppy-text-muted">Multiplayer only</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FilterPill({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <motion.span
      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-sloppy-primary/15 text-sloppy-primary rounded-full"
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.8, opacity: 0 }}
    >
      {label}
      <button
        className="cursor-pointer bg-transparent border-0 p-0 text-sloppy-primary hover:text-white transition-colors"
        onClick={onRemove}
        aria-label={`Remove ${label} filter`}
      >
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </motion.span>
  );
}
