import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { ThemeProvider } from './lib/theme';
import { ToastProvider } from './components/Toaster';
import './index.css';
import './design.css';
import './motion.css';

// Filet global : si un observateur ne s'exécute pas (navigateur ancien, JS partiel),
// le contenu redevient lisible au lieu de rester invisible.
window.setTimeout(() => document.documentElement.classList.add('reveal-fallback'), 2500);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const root = document.getElementById('root');
if (!root) throw new Error('Élément #root introuvable dans index.html');

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
      <ToastProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ToastProvider>
    </ThemeProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
