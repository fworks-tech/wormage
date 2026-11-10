import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { initApiLayer } from './api/client';
import './styles.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 15_000,
      refetchOnWindowFocus: true,
    },
  },
});

/**
 * Boot order matters: the API transport (MSW service worker vs in-process
 * adapter) must be decided before the first query fires.
 */
async function boot(): Promise<void> {
  // '/' goes straight to the playable demo; keep `?seed=` for reproducible tests.
  if (window.location.pathname === '/') {
    window.history.replaceState(null, '', `/demo${window.location.search}${window.location.hash}`);
  }
  await initApiLayer();
  const container = document.getElementById('root');
  if (!container) throw new Error('Root element missing');
  ReactDOM.createRoot(container).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </React.StrictMode>,
  );
}

void boot();
