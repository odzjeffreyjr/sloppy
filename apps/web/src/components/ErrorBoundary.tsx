import { Component, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import * as Sentry from '@sentry/react';

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;

let sentryInitialized = false;

export function initFrontendSentry(): void {
  if (!SENTRY_DSN || sentryInitialized) return;

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.MODE || 'development',
    release: import.meta.env.VITE_APP_VERSION || undefined,
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],
  });

  sentryInitialized = true;
}

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('[ErrorBoundary]', error, info.componentStack);
    reportFrontendError(error, { componentStack: info.componentStack ?? '' });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex items-center justify-center min-h-[60vh] px-4">
          <motion.div
            className="text-center max-w-md"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          >
            <span className="text-7xl block mb-4">🫠</span>
            <h2 className="font-heading text-3xl text-sloppy-dark mb-2">
              Oops! Something went sloppy wrong
            </h2>
            <p className="text-sloppy-dark/60 mb-6">
              {this.state.error?.message ?? 'An unexpected error occurred'}
            </p>
            <motion.button
              className="cursor-pointer px-6 py-3 bg-sloppy-pink text-white font-bold rounded-wobbly shadow-lg"
              whileHover={{ scale: 1.05, rotate: 1 }}
              whileTap={{ scale: 0.95 }}
              onClick={this.handleRetry}
            >
              Try Again
            </motion.button>
          </motion.div>
        </div>
      );
    }

    return this.props.children;
  }
}

export function reportFrontendError(
  error: Error,
  extras?: Record<string, string>,
): void {
  if (!sentryInitialized) return;

  Sentry.withScope((scope) => {
    if (extras) {
      for (const [key, value] of Object.entries(extras)) {
        scope.setExtra(key, value);
      }
    }
    Sentry.captureException(error);
  });
}
