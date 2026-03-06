import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { initFrontendSentry, reportFrontendError } from './components/ErrorBoundary';
import './index.css';

initFrontendSentry();

window.addEventListener('error', (event) => {
  if (event.error instanceof Error) {
    reportFrontendError(event.error, { context: 'window.onerror' });
  }
});

window.addEventListener('unhandledrejection', (event) => {
  const error =
    event.reason instanceof Error
      ? event.reason
      : new Error(String(event.reason));
  reportFrontendError(error, { context: 'unhandledrejection' });
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
