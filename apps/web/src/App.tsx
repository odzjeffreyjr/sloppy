import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { IntroAnimation } from './components/IntroAnimation';
import { MusicPlayer } from './components/MusicPlayer';
import { SloppySpinner } from './components/ui/SloppySpinner';
import { ErrorBoundary } from './components/ErrorBoundary';
import { OfflineBanner } from './components/OfflineBanner';
import { PWAInstallPrompt } from './components/PWAInstallPrompt';

const Home = lazy(() => import('./pages/Home'));
const Create = lazy(() => import('./pages/Create'));
const Favourites = lazy(() => import('./pages/Favourites'));
const MyGames = lazy(() => import('./pages/MyGames'));
const GameView = lazy(() => import('./pages/GameView'));

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <SloppySpinner size={64} />
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <OfflineBanner />
      <PWAInstallPrompt />
      <IntroAnimation />
      <MusicPlayer />

      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route element={<Layout />}>
            <Route
              path="/"
              element={
                <ErrorBoundary>
                  <Home />
                </ErrorBoundary>
              }
            />
            <Route
              path="/create"
              element={
                <ErrorBoundary>
                  <Create />
                </ErrorBoundary>
              }
            />
            <Route
              path="/favourites"
              element={
                <ErrorBoundary>
                  <Favourites />
                </ErrorBoundary>
              }
            />
            <Route
              path="/my-games"
              element={
                <ErrorBoundary>
                  <MyGames />
                </ErrorBoundary>
              }
            />
            <Route
              path="/game/:id"
              element={
                <ErrorBoundary>
                  <GameView />
                </ErrorBoundary>
              }
            />
          </Route>
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}

export default App;
