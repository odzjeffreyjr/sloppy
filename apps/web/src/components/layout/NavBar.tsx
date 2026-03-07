import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Volume2, VolumeX } from 'lucide-react';
import { useAuthStore } from '../../stores/auth';
import { useUIStore } from '../../stores/ui';
import { Avatar } from '../ui/Avatar';
import { useState, useEffect } from 'react';

export function NavBar() {
  const { isAuthenticated, user, login, logout } = useAuthStore();
  const [searchFocused, setSearchFocused] = useState(false);
  const isMusicPlaying = useUIStore((s) => s.isMusicPlaying);
  const toggleMusic = useUIStore((s) => s.toggleMusic);
  const hasSeenSoundIcon = useUIStore((s) => s.hasSeenSoundIcon);
  const markSoundIconSeen = useUIStore((s) => s.markSoundIconSeen);
  const [shouldBounce, setShouldBounce] = useState(!hasSeenSoundIcon);

  useEffect(() => {
    if (!hasSeenSoundIcon) {
      const timer = setTimeout(() => {
        markSoundIconSeen();
        setShouldBounce(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [hasSeenSoundIcon, markSoundIconSeen]);

  return (
    <motion.nav
      className="sticky top-0 z-40 glass border-b border-sloppy-border"
      initial={{ y: -60 }}
      animate={{ y: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
    >
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        {/* mobile logo */}
        <Link to="/" className="no-underline flex items-center gap-2 md:hidden">
          <motion.img
            src="/sloppy_logo.png"
            alt="Sloppy"
            className="w-9 h-9 rounded-lg"
            whileHover={{ scale: 1.1 }}
          />
        </Link>

        {/* search — centered on desktop, icon-only on mobile */}
        <div className="hidden md:flex flex-1 max-w-md mx-auto">
          <div className={`
            relative w-full transition-all duration-200
            ${searchFocused ? 'scale-[1.02]' : ''}
          `}>
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-sloppy-text-muted" />
            <input
              type="text"
              placeholder="Search games..."
              className="w-full pl-9 pr-4 py-2 bg-sloppy-surface text-sloppy-text text-sm rounded-wobbly border border-sloppy-border outline-none focus:ring-2 focus:ring-sloppy-primary/50 focus:border-sloppy-primary/50 placeholder:text-sloppy-text-muted/60 transition-all"
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
            />
          </div>
        </div>

        {/* right side */}
        <div className="flex items-center gap-3">
          {/* mobile search icon */}
          <Link
            to="/explore"
            className="md:hidden p-2 rounded-wobbly text-sloppy-text-muted hover:text-sloppy-text hover:bg-sloppy-surface-hover transition-colors no-underline"
          >
            <SearchIcon className="w-5 h-5" />
          </Link>

          {/* sound toggle */}
          <motion.button
            className="cursor-pointer p-2 rounded-full text-sloppy-text-muted hover:text-sloppy-text hover:bg-sloppy-surface-hover transition-colors bg-transparent border-0 relative"
            onClick={() => {
              toggleMusic();
              if (!hasSeenSoundIcon) {
                markSoundIconSeen();
                setShouldBounce(false);
              }
            }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            animate={shouldBounce ? { y: [0, -4, 0, -2, 0] } : {}}
            transition={shouldBounce ? { duration: 1.2, repeat: Infinity, repeatDelay: 1.5 } : { type: 'spring', stiffness: 400, damping: 17 }}
            aria-label={isMusicPlaying ? 'Mute music' : 'Unmute music'}
          >
            {isMusicPlaying ? (
              <Volume2 className="w-5 h-5 text-sloppy-primary" />
            ) : (
              <VolumeX className="w-5 h-5" />
            )}
          </motion.button>

          {/* create button — desktop only */}
          <Link to="/create" className="hidden md:block no-underline">
            <motion.button
              className="cursor-pointer flex items-center gap-2 px-4 py-2 bg-sloppy-primary text-white text-sm font-semibold rounded-full shadow-lg shadow-sloppy-primary/25 hover:shadow-sloppy-primary/40 transition-shadow"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Create
            </motion.button>
          </Link>

          {isAuthenticated ? (
            <div className="flex items-center gap-2">
              <Avatar
                name={user?.displayName ?? user?.email}
                size={34}
                borderColorClass="border-sloppy-primary"
              />
              <motion.button
                className="cursor-pointer text-xs text-sloppy-text-muted hover:text-sloppy-text font-medium bg-transparent border-0"
                onClick={logout}
                whileHover={{ scale: 1.05 }}
              >
                Logout
              </motion.button>
            </div>
          ) : (
            <motion.button
              className="cursor-pointer px-4 py-2 bg-sloppy-primary text-white text-sm font-semibold rounded-full"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => login('google')}
            >
              Sign in
            </motion.button>
          )}
        </div>
      </div>
    </motion.nav>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  );
}
