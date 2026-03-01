import { Outlet } from 'react-router-dom';
import { NavBar } from './NavBar';
import { BottomNav } from './BottomNav';
import { GameOverlay } from './GameOverlay';
import { SloppyToastContainer } from '../ui/SloppyToast';

export function Layout() {
  return (
    <div className="min-h-screen bg-sloppy-cream">
      <NavBar />

      <main className="max-w-6xl mx-auto px-4 py-6 pb-24 md:pb-6">
        <Outlet />
      </main>

      <BottomNav />
      <GameOverlay />
      <SloppyToastContainer />
    </div>
  );
}
