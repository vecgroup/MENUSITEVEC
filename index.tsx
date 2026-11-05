
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Prevent stale refresh token rejections or logs from crashing the app
if (typeof window !== 'undefined') {
  const isRefreshTokenIssue = (err: any): boolean => {
    if (!err) return false;
    const str = typeof err === 'string' 
      ? err 
      : (err?.message || err?.error_description || (typeof err === 'object' ? `${err.name || ''}: ${err.message || JSON.stringify(err)}` : String(err)));
    const lower = String(str).toLowerCase();
    return lower.includes('refresh token') || lower.includes('refresh_token') || lower.includes('invalid_grant');
  };

  const originalConsoleError = console.error;
  console.error = function (...args: any[]) {
    for (const arg of args) {
      if (isRefreshTokenIssue(arg)) {
        console.warn('[Auth] Stale refresh token notice suppressed.');
        return;
      }
    }
    return originalConsoleError.apply(this, args);
  };

  window.addEventListener('unhandledrejection', (event) => {
    if (isRefreshTokenIssue(event.reason)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  });

  window.addEventListener('error', (event) => {
    if (isRefreshTokenIssue(event.message) || isRefreshTokenIssue(event.error)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  });
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
