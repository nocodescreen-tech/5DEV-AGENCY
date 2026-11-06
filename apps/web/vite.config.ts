import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';

export default defineConfig({
  plugins: [react()],
  // PostCSS est configuré ici plutôt que dans postcss.config.js : Vite charge
  // les plugins directement (pas de résolution de config via jiti).
  css: {
    postcss: {
      plugins: [tailwindcss(), autoprefixer()],
    },
  },
  server: {
    port: 5173,
    proxy: {
      // l'API tourne sur 4000 en développement
      '/api': { target: 'http://127.0.0.1:4000', changeOrigin: true },
      '/healthz': { target: 'http://127.0.0.1:4000', changeOrigin: true },
    },
  },
  // `vite preview` sert le build : on garde le même proxy pour que les mesures
  // de performance portent sur l'application réellement alimentée.
  preview: {
    port: 4173,
    proxy: {
      '/api': { target: 'http://127.0.0.1:4000', changeOrigin: true },
      '/healthz': { target: 'http://127.0.0.1:4000', changeOrigin: true },
    },
  },
  build: { outDir: 'dist', sourcemap: false },
});
