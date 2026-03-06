import { Outlet } from 'react-router-dom';
import { NavBar } from './NavBar';
import { Sidebar } from './Sidebar';
import { BottomNav } from './BottomNav';
import { GameOverlay } from './GameOverlay';
import { SloppyToastContainer } from '../ui/SloppyToast';

export function Layout() {
  return (
    <div className="min-h-screen bg-sloppy-bg flex">
      <Sidebar />

      <div className="flex-1 flex flex-col min-h-screen">
        <NavBar />

        <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 pb-24 md:pb-6">
          <Outlet />
        </main>
      </div>

      <BottomNav />
      <GameOverlay />
      <SloppyToastContainer />
    </div>
  );
}
