import { Outlet } from 'react-router-dom';
import { NavBar } from './NavBar';
import { Sidebar } from './Sidebar';
import { BottomNav } from './BottomNav';
import { GameOverlay } from './GameOverlay';
import { SloppyToastContainer } from '../ui/SloppyToast';

export function Layout() {
  return (
    <div className="h-screen bg-sloppy-bg flex overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col h-full min-w-0">
        <NavBar />

        <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-6 pb-24 md:pb-6 min-w-0 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      <BottomNav />
      <GameOverlay />
      <SloppyToastContainer />
    </div>
  );
}
