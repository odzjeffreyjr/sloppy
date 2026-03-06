import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
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
const Explore = lazy(() => import('./pages/Explore'));
const Category = lazy(() => import('./pages/Category'));
const Game = lazy(() => import('./pages/Game'));
const Feed = lazy(() => import('./pages/Feed'));
const Creator = lazy(() => import('./pages/Creator'));
const DashboardLayout = lazy(() => import('./pages/Dashboard/DashboardLayout'));
const Settings = lazy(() => import('./pages/Dashboard/Settings'));
const Earnings = lazy(() => import('./pages/Dashboard/Earnings'));

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
          {/* Full-viewport feed — outside Layout (no sidebar/navbar) */}
          <Route
            path="/feed"
            element={
              <ErrorBoundary>
                <Feed />
              </ErrorBoundary>
            }
          />

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
              path="/explore"
              element={
                <ErrorBoundary>
                  <Explore />
                </ErrorBoundary>
              }
            />
            <Route
              path="/category/:genre"
              element={
                <ErrorBoundary>
                  <Category />
                </ErrorBoundary>
              }
            />
            <Route
              path="/game/:id"
              element={
                <ErrorBoundary>
                  <Game />
                </ErrorBoundary>
              }
            />
            <Route
              path="/creator/:userId"
              element={
                <ErrorBoundary>
                  <Creator />
                </ErrorBoundary>
              }
            />

            {/* Legacy redirect */}
            <Route path="/my-games" element={<Navigate to="/dashboard/games" replace />} />

            {/* Dashboard section */}
            <Route
              path="/dashboard"
              element={
                <ErrorBoundary>
                  <DashboardLayout />
                </ErrorBoundary>
              }
            >
              <Route index element={<Navigate to="/dashboard/games" replace />} />
              <Route
                path="games"
                element={
                  <ErrorBoundary>
                    <MyGames />
                  </ErrorBoundary>
                }
              />
              <Route
                path="earnings"
                element={
                  <ErrorBoundary>
                    <Earnings />
                  </ErrorBoundary>
                }
              />
              <Route
                path="settings"
                element={
                  <ErrorBoundary>
                    <Settings />
                  </ErrorBoundary>
                }
              />
            </Route>
          </Route>
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}

export default App;
