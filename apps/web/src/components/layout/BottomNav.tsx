import { motion } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';

const tabs = [
  { to: '/', label: 'Home', icon: '🏠' },
  { to: '/create', label: 'Create', icon: '✨' },
  { to: '/favourites', label: 'Favs', icon: '❤️' },
];

export function BottomNav() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-white/90 backdrop-blur-md border-t-2 border-sloppy-dark/5">
      <div className="flex items-center justify-around h-16">
        {tabs.map((tab) => {
          const isActive = location.pathname === tab.to;
          return (
            <Link
              key={tab.to}
              to={tab.to}
              className="no-underline flex flex-col items-center gap-0.5"
            >
              <motion.span
                className="text-xl"
                animate={isActive ? { scale: 1.2, y: -2 } : { scale: 1, y: 0 }}
                whileTap={{ scale: 0.8 }}
                transition={{ type: 'spring', stiffness: 400, damping: 15 }}
              >
                {tab.icon}
              </motion.span>
              <span
                className={`text-[10px] font-bold ${
                  isActive ? 'text-sloppy-pink' : 'text-sloppy-dark/40'
                }`}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
