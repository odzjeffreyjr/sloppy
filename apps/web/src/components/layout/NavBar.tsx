import { motion } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth';
import { useUIStore } from '../../stores/ui';
import { Avatar } from '../ui/Avatar';

const navLinks = [
  { to: '/', label: 'Home' },
  { to: '/create', label: 'Create' },
  { to: '/favourites', label: 'Favs' },
];

export function NavBar() {
  const location = useLocation();
  const { isAuthenticated, user, login, logout } = useAuthStore();
  const { isMusicPlaying, toggleMusic } = useUIStore();

  return (
    <motion.nav
      className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b-2 border-sloppy-dark/5"
      initial={{ y: -60 }}
      animate={{ y: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
    >
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* logo */}
        <Link to="/" className="no-underline">
          <motion.span
            className="font-heading text-2xl text-sloppy-pink select-none"
            whileHover={{ rotate: [-2, 3, -1, 0], scale: 1.05 }}
            transition={{ duration: 0.4 }}
          >
            sloppy
          </motion.span>
        </Link>

        {/* nav links — hidden on mobile */}
        <div className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => {
            const isActive = location.pathname === link.to;
            return (
              <Link key={link.to} to={link.to} className="no-underline">
                <motion.span
                  className={`
                    px-4 py-2 rounded-wobbly text-sm font-bold cursor-pointer
                    transition-colors
                    ${isActive
                      ? 'bg-sloppy-pink/10 text-sloppy-pink'
                      : 'text-sloppy-dark/60 hover:text-sloppy-dark'}
                  `}
                  whileHover={{ y: -2, rotate: isActive ? 0 : 2 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                >
                  {link.label}
                </motion.span>
              </Link>
            );
          })}
        </div>

        {/* right side */}
        <div className="flex items-center gap-3">
          <motion.button
            className="cursor-pointer text-xl p-2 rounded-full hover:bg-sloppy-dark/5"
            onClick={toggleMusic}
            whileHover={{ scale: 1.15, rotate: 10 }}
            whileTap={{ scale: 0.9 }}
            aria-label={isMusicPlaying ? 'Mute music' : 'Unmute music'}
          >
            {isMusicPlaying ? '🔊' : '🔇'}
          </motion.button>

          {isAuthenticated ? (
            <div className="flex items-center gap-2">
              <Avatar
                name={user?.displayName ?? user?.email}
                size={36}
              />
              <motion.button
                className="cursor-pointer text-xs text-sloppy-dark/40 hover:text-sloppy-dark font-medium"
                onClick={logout}
                whileHover={{ scale: 1.05 }}
              >
                Logout
              </motion.button>
            </div>
          ) : (
            <motion.button
              className="cursor-pointer px-4 py-2 bg-sloppy-pink text-white text-sm font-bold rounded-wobbly"
              whileHover={{ scale: 1.05, rotate: -1 }}
              whileTap={{ scale: 0.95 }}
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
