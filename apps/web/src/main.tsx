import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { ThemeProvider } from './lib/theme';
import { ToastProvider } from './components/Toaster';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';
import './design.css';
import './motion.css';

// Filet global : si un observateur ne s'exécute pas (navigateur ancien, JS partiel),
// le contenu redevient lisible au lieu de rester invisible.
window.setTimeout(() => document.documentElement.classList.add('reveal-fallback'), 2500);

// Chien de garde : si React n'a rien monté après 4 s (bundle en échec, thème
// corrompu, cache périmé), on affiche une issue au lieu de laisser un écran noir.
window.setTimeout(() => {
  const racine = document.getElementById('root');
  if (!racine || racine.childElementCount > 0) return;
  racine.innerHTML = [
    '<div style="max-width:34rem;margin:12vh auto;padding:0 1.5rem;font-family:system-ui,sans-serif;color:#171717">',
    '<p style="font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#d9610f;margin:0">Affichage interrompu</p>',
    '<h1 style="font-size:1.5rem;margin:.4rem 0 .6rem">La page n’a pas pu se charger.</h1>',
    '<p style="font-size:.9rem;line-height:1.6;color:#737373;margin:0 0 1rem">Le navigateur a gardé une version ancienne ou corrompue de l’application. Rechargez, ou réinitialisez les préférences d’affichage.</p>',
    '<button id="five-reload" style="background:#f47721;color:#fff;border:0;border-radius:999px;padding:.65rem 1.1rem;font-weight:600;cursor:pointer">Recharger la page</button>',
    '<button id="five-reset" style="background:transparent;border:1px solid #e6e2dd;border-radius:999px;padding:.65rem 1.1rem;margin-left:.5rem;cursor:pointer">Réinitialiser l’affichage</button>',
    '</div>',
  ].join('');
  document.getElementById('five-reload')?.addEventListener('click', () => window.location.reload());
  document.getElementById('five-reset')?.addEventListener('click', () => {
    try { localStorage.removeItem('five.theme'); } catch { /* ignore */ }
    window.location.reload();
  });
}, 4000);

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
    <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
      <ToastProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ToastProvider>
    </ThemeProvider>
    </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
