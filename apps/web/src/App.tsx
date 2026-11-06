import { Route, Routes } from 'react-router-dom';
import Home from './pages/Home';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route
        path="*"
        element={
          <main className="grid min-h-dvh place-items-center bg-[#050505] px-6 text-center">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.3em] text-[#00cfc8]">404</p>
              <h1 className="mt-3 text-3xl font-black">Page introuvable</h1>
              <a href="/" className="mt-6 inline-block text-sm text-neutral-400 underline">
                Retour à l’accueil
              </a>
            </div>
          </main>
        }
      />
    </Routes>
  );
}
