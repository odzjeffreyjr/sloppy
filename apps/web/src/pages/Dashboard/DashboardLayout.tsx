import { NavLink, Outlet } from 'react-router-dom';
import { motion } from 'framer-motion';

const tabs = [
  { to: '/dashboard/games', label: 'My Games', icon: GamesIcon },
  { to: '/dashboard/earnings', label: 'Earnings', icon: EarningsIcon },
  { to: '/dashboard/settings', label: 'Settings', icon: SettingsIcon },
];

export default function DashboardLayout() {
  return (
    <div className="flex gap-6 min-h-[60vh]">
      {/* Desktop sidebar sub-nav */}
      <motion.aside
        className="hidden md:flex flex-col w-56 shrink-0 bg-sloppy-surface rounded-wobbly-lg border border-sloppy-border p-3 gap-1 h-fit sticky top-24"
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      >
        <h2 className="font-heading text-lg text-sloppy-text px-3 py-2">Dashboard</h2>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              end
              className="no-underline"
            >
              {({ isActive }) => (
                <motion.div
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-wobbly text-sm font-medium transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-sloppy-primary/15 text-sloppy-primary'
                      : 'text-sloppy-text-muted hover:text-sloppy-text hover:bg-sloppy-surface-hover'
                  }`}
                  whileHover={{ x: 2 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Icon className="w-4.5 h-4.5 shrink-0" />
                  <span>{tab.label}</span>
                </motion.div>
              )}
            </NavLink>
          );
        })}
      </motion.aside>

      {/* Main content area */}
      <div className="flex-1 min-w-0">
        {/* Mobile tab bar */}
        <div className="md:hidden flex gap-1 mb-4 bg-sloppy-surface rounded-wobbly-lg border border-sloppy-border p-1.5 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                end
                className="no-underline flex-1 min-w-0"
              >
                {({ isActive }) => (
                  <div
                    className={`flex items-center justify-center gap-2 px-3 py-2 rounded-wobbly text-sm font-medium transition-colors whitespace-nowrap ${
                      isActive
                        ? 'bg-sloppy-primary/15 text-sloppy-primary'
                        : 'text-sloppy-text-muted'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{tab.label}</span>
                  </div>
                )}
              </NavLink>
            );
          })}
        </div>

        <Outlet />
      </div>
    </div>
  );
}

function GamesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="6" width="20" height="12" rx="4" />
      <path d="M6 12h4M8 10v4" />
      <circle cx="16" cy="10" r="1" fill="currentColor" />
      <circle cx="18" cy="12" r="1" fill="currentColor" />
    </svg>
  );
}

function EarningsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
    </svg>
  );
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  );
}
