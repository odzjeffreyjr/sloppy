import { Component, type ReactNode } from 'react';
import { motion } from 'framer-motion';

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
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;

  try {
    const url = new URL(dsn);
    const publicKey = url.username;
    const host = url.host;
    const projectId = url.pathname.replace('/', '');

    const payload = {
      exception: {
        values: [
          {
            type: error.name,
            value: error.message,
            stacktrace: error.stack
              ? {
                  frames: error.stack
                    .split('\n')
                    .slice(1, 11)
                    .map((line: string) => ({ filename: line.trim() })),
                }
              : undefined,
          },
        ],
      },
      tags: { service: 'web' },
      extra: extras ?? {},
      platform: 'javascript',
      timestamp: Date.now() / 1000,
    };

    fetch(`https://${host}/api/${projectId}/store/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Sentry-Auth': `Sentry sentry_version=7, sentry_client=sloppy-web/1.0, sentry_key=${publicKey}`,
      },
      body: JSON.stringify(payload),
    }).catch(() => {});
  } catch {
    // Sentry reporting should never crash the app
  }
}
