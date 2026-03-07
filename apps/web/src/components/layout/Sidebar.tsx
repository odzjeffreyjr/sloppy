import { motion, AnimatePresence } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';
import { useState } from 'react';

const mainNav = [
  { to: '/', label: 'Home', icon: HomeIcon },
  { to: '/feed', label: 'Feed', icon: FeedIcon },
  { to: '/explore', label: 'Explore', icon: ExploreIcon },
  { to: '/favourites', label: 'Favourites', icon: HeartIcon },
  { to: '/create', label: 'Create', icon: CreateIcon },
  { to: '/dashboard', label: 'Dashboard', icon: ProfileIcon },
];

const categories = [
  { to: '/category/2d-arcade', label: 'Arcade', color: '#ef4444' },
  { to: '/category/2d-puzzle', label: 'Puzzle', color: '#3b82f6' },
  { to: '/category/3d-racing', label: 'Racing', color: '#f97316' },
  { to: '/category/2d-platformer', label: 'Platformer', color: '#22c55e' },
  { to: '/category/3d-firstperson', label: 'FPS', color: '#eab308' },
  { to: '/category/2d-shooter', label: 'Shooter', color: '#06b6d4' },
];

export function Sidebar() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <motion.aside
      className="hidden md:flex flex-col h-screen sticky top-0 border-r border-sloppy-border bg-sloppy-surface z-30"
      animate={{ width: collapsed ? 72 : 240 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      <div className="flex items-center gap-2 px-4 h-16 shrink-0">
        <Link to="/" className="no-underline flex items-center gap-2 overflow-hidden">
          <motion.img
            src="/sloppy_logo.png"
            alt="Sloppy"
            className="w-9 h-9 rounded-lg shrink-0"
            whileHover={{ scale: 1.1 }}
          />
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                className="font-heading text-xl text-sloppy-primary whitespace-nowrap select-none"
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
              >
                sloppy
              </motion.span>
            )}
          </AnimatePresence>
        </Link>
      </div>

      <nav className="flex-1 px-2 py-2 overflow-y-auto space-y-1">
        {mainNav.map((item) => {
          const isActive = item.to === '/'
            ? location.pathname === '/'
            : location.pathname === item.to || location.pathname.startsWith(item.to + '/');
          const Icon = item.icon;
          return (
            <Link key={item.to} to={item.to} className="no-underline block">
              <motion.div
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-wobbly text-sm font-medium
                  transition-colors cursor-pointer
                  ${isActive
                    ? 'bg-sloppy-primary/15 text-sloppy-primary'
                    : 'text-sloppy-text-muted hover:text-sloppy-text hover:bg-sloppy-surface-hover'}
                `}
                whileHover={{ x: 2 }}
                whileTap={{ scale: 0.98 }}
              >
                <Icon className="w-5 h-5 shrink-0" active={isActive} />
                <AnimatePresence>
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="whitespace-nowrap"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.div>
            </Link>
          );
        })}
      </nav>

      {!collapsed && (
        <div className="px-2 pb-2">
          <div className="border-t border-sloppy-border pt-3 pb-1 px-3">
            <span className="text-[11px] uppercase tracking-wider text-sloppy-text-muted/60 font-semibold">
              Categories
            </span>
          </div>
          <div className="space-y-0.5">
            {categories.map((cat) => {
              const isActive = location.pathname === cat.to;
              return (
                <Link key={cat.to} to={cat.to} className="no-underline block">
                  <motion.div
                    className={`
                      flex items-center gap-3 px-3 py-2 rounded-wobbly text-sm
                      transition-colors cursor-pointer
                      ${isActive
                        ? 'text-sloppy-text bg-sloppy-surface-hover'
                        : 'text-sloppy-text-muted hover:text-sloppy-text hover:bg-sloppy-surface-hover'}
                    `}
                    whileHover={{ x: 2 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span className="whitespace-nowrap">{cat.label}</span>
                  </motion.div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <button
        className="cursor-pointer mx-2 mb-3 p-2 rounded-wobbly text-sloppy-text-muted hover:text-sloppy-text hover:bg-sloppy-surface-hover transition-colors border-0 bg-transparent"
        onClick={() => setCollapsed((c) => !c)}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        <svg className="w-5 h-5 mx-auto" viewBox="0 0 20 20" fill="currentColor">
          {collapsed ? (
            <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
          ) : (
            <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
          )}
        </svg>
      </button>
    </motion.aside>
  );
}

function HomeIcon({ className, active }: { className?: string; active?: boolean }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" />
      <path d="M9 21V12h6v9" />
    </svg>
  );
}

function FeedIcon({ className, active }: { className?: string; active?: boolean }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}

function ExploreIcon({ className, active }: { className?: string; active?: boolean }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" fill={active ? 'currentColor' : 'none'} />
    </svg>
  );
}

function HeartIcon({ className, active }: { className?: string; active?: boolean }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
    </svg>
  );
}

function CreateIcon({ className, active }: { className?: string; active?: boolean }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  );
}

function ProfileIcon({ className, active }: { className?: string; active?: boolean }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
