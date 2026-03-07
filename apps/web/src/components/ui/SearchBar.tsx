import { motion, AnimatePresence } from 'framer-motion';
import { useState, useRef, useCallback, useEffect } from 'react';

interface SearchBarProps {
  onSearch: (query: string) => void;
  placeholder?: string;
  debounceMs?: number;
  className?: string;
}

const MAX_RECENT = 5;
const STORAGE_KEY = 'sloppy-recent-searches';

function getRecentSearches(): string[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function addRecentSearch(query: string) {
  const trimmed = query.trim();
  if (!trimmed) return;
  const recent = getRecentSearches().filter((s) => s !== trimmed);
  recent.unshift(trimmed);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
}

export function SearchBar({
  onSearch,
  placeholder = 'Search games...',
  debounceMs = 300,
  className = '',
}: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (focused) {
      setRecentSearches(getRecentSearches());
    }
  }, [focused]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setQuery(value);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        onSearch(value);
      }, debounceMs);
    },
    [onSearch, debounceMs],
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      clearTimeout(timerRef.current);
      if (query.trim()) {
        addRecentSearch(query);
        onSearch(query);
      }
      inputRef.current?.blur();
    },
    [query, onSearch],
  );

  const selectRecent = useCallback(
    (search: string) => {
      setQuery(search);
      onSearch(search);
      addRecentSearch(search);
      inputRef.current?.blur();
    },
    [onSearch],
  );

  const showDropdown = focused && query === '' && recentSearches.length > 0;

  return (
    <form onSubmit={handleSubmit} className={`relative ${className}`}>
      <div className={`
        relative transition-all duration-200
        ${focused ? 'scale-[1.01]' : ''}
      `}>
        <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-sloppy-text-muted pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder={placeholder}
          className="w-full pl-10 pr-4 py-2.5 bg-sloppy-surface text-sloppy-text text-sm rounded-wobbly border border-sloppy-border outline-none focus:ring-2 focus:ring-sloppy-primary/50 focus:border-sloppy-primary/50 placeholder:text-sloppy-text-muted/50 transition-all"
        />
        {query && (
          <button
            type="button"
            className="cursor-pointer absolute right-3 top-1/2 -translate-y-1/2 text-sloppy-text-muted hover:text-sloppy-text bg-transparent border-0 p-0"
            onClick={() => {
              setQuery('');
              onSearch('');
              inputRef.current?.focus();
            }}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <AnimatePresence>
        {showDropdown && (
          <motion.div
            className="absolute top-full left-0 right-0 mt-1 bg-sloppy-surface border border-sloppy-border rounded-wobbly shadow-xl z-20 overflow-hidden"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
          >
            <div className="px-3 py-2 text-[11px] text-sloppy-text-muted/60 uppercase tracking-wider font-semibold">
              Recent
            </div>
            {recentSearches.map((search) => (
              <button
                key={search}
                type="button"
                className="cursor-pointer w-full text-left px-3 py-2 text-sm text-sloppy-text-muted hover:text-sloppy-text hover:bg-sloppy-surface-hover transition-colors flex items-center gap-2 border-0 bg-transparent"
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectRecent(search);
                }}
              >
                <svg className="w-3.5 h-3.5 shrink-0 text-sloppy-text-muted/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v6l4 2" />
                </svg>
                {search}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </form>
  );
}
