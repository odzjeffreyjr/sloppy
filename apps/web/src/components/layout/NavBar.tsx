import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { Volume2, VolumeX } from 'lucide-react';
import { useAuthStore } from '../../stores/auth';
import { useUIStore } from '../../stores/ui';
import { Avatar } from '../ui/Avatar';
import { useState, useEffect, useCallback } from 'react';

export function NavBar() {
  const navigate = useNavigate();
  const { isAuthenticated, user, login, logout } = useAuthStore();
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const isMuted = useUIStore((s) => s.isMuted);
  const toggleMute = useUIStore((s) => s.toggleMute);
  const hasSeenSoundIcon = useUIStore((s) => s.hasSeenSoundIcon);
  const markSoundIconSeen = useUIStore((s) => s.markSoundIconSeen);
  const [shouldBounce, setShouldBounce] = useState(!hasSeenSoundIcon);

  const handleSearchSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const q = searchQuery.trim();
      if (q) {
        navigate(`/explore?q=${encodeURIComponent(q)}`);
        setSearchQuery('');
        (document.activeElement as HTMLElement)?.blur();
      }
    },
    [searchQuery, navigate],
  );

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
      <div className="w-full mx-auto px-2 sm:px-4 h-14 sm:h-16 flex items-center gap-1 sm:gap-2 md:gap-4 min-w-0">
        {/* Logo — always visible, links home */}
        <Link to="/" className="no-underline flex items-center shrink-0">
          <motion.img
            src="/sloppy_logo.png"
            alt="Sloppy"
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg"
            whileHover={{ scale: 1.1 }}
          />
        </Link>

        {/* Search — always visible, compact on small screens, expands on larger */}
        <form className="flex flex-1 min-w-0" onSubmit={handleSearchSubmit}>
          <div className={`
            relative w-full transition-all duration-200
            ${searchFocused ? 'scale-[1.02]' : ''}
          `}>
            <SearchIcon className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 text-sloppy-text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="w-full pl-7 sm:pl-9 pr-2 sm:pr-4 py-1.5 sm:py-2 bg-sloppy-surface text-sloppy-text text-base sm:text-sm rounded-wobbly border border-sloppy-border outline-none focus:ring-2 focus:ring-sloppy-primary/50 focus:border-sloppy-primary/50 placeholder:text-sloppy-text-muted/60 transition-all"
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
            />
          </div>
        </form>

        {/* Right-side actions — always visible, adapt sizing */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Sound toggle — always visible */}
          <motion.button
            className="cursor-pointer p-1.5 sm:p-2 rounded-full text-sloppy-text-muted hover:text-sloppy-text hover:bg-sloppy-surface-hover transition-colors bg-transparent border-0 relative shrink-0"
            onClick={() => {
              toggleMute();
              if (!hasSeenSoundIcon) {
                markSoundIconSeen();
                setShouldBounce(false);
              }
            }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            animate={shouldBounce ? { y: [0, -4, 0, -2, 0] } : {}}
            transition={shouldBounce ? { duration: 1.2, repeat: Infinity, repeatDelay: 1.5 } : { type: 'spring', stiffness: 400, damping: 17 }}
            aria-label={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? (
              <VolumeX className="w-4 h-4 sm:w-5 sm:h-5" />
            ) : (
              <Volume2 className="w-4 h-4 sm:w-5 sm:h-5 text-sloppy-primary" />
            )}
          </motion.button>

          {/* Create button — always visible: icon-only on small screens, with label on md+ */}
          <Link to="/create" className="no-underline shrink-0">
            <motion.button
              className="cursor-pointer flex items-center gap-1.5 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 bg-sloppy-primary text-white text-xs sm:text-sm font-semibold rounded-full shadow-lg shadow-sloppy-primary/25 hover:shadow-sloppy-primary/40 transition-shadow"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              <span className="hidden md:inline">Create</span>
            </motion.button>
          </Link>

          {/* Auth / profile — always visible */}
          {isAuthenticated ? (
            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
              <Link to="/dashboard" className="no-underline shrink-0" aria-label="Dashboard">
                <Avatar
                  name={user?.displayName ?? user?.email}
                  size={30}
                  borderColorClass="border-sloppy-primary"
                />
              </Link>
              <motion.button
                className="cursor-pointer text-[10px] sm:text-xs text-sloppy-text-muted hover:text-sloppy-text font-medium bg-transparent border-0 shrink-0"
                onClick={logout}
                whileHover={{ scale: 1.05 }}
              >
                Logout
              </motion.button>
            </div>
          ) : (
            <motion.button
              className="cursor-pointer px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 bg-sloppy-surface border border-sloppy-border text-sloppy-text text-xs sm:text-sm font-semibold rounded-full hover:bg-sloppy-surface-hover transition-colors shrink-0"
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
