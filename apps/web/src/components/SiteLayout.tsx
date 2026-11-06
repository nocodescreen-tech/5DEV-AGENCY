import { Link, NavLink, Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { apiGet } from '../lib/api';
import type { Settings } from '../lib/types';

const NAV = [
  { to: '/services', label: 'Services' },
  { to: '/realisations', label: 'Réalisations' },
  { to: '/a-propos', label: 'À propos' },
  { to: '/contact', label: 'Contact' },
];

export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: () => apiGet<Settings>('/api/v1/settings'),
    staleTime: 5 * 60_000,
  });
}

export default function SiteLayout() {
  const [open, setOpen] = useState(false);
  const { data } = useSettings();
  const studio = data?.studio;

  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      <header className="sticky top-0 z-40 border-b border-line bg-paper/95 backdrop-blur">
        <div className="container-x flex h-16 items-center justify-between">
          <Link to="/" className="flex items-baseline gap-2" aria-label="5DEV — accueil">
            <span className="text-xl font-black tracking-tight">
              5<span className="text-brand">DEV</span>
            </span>
            <span className="hidden font-mono text-[10px] uppercase tracking-[0.28em] text-muted sm:block">
              Build · Innovate · Grow
            </span>
          </Link>

          <nav className="hidden items-center gap-7 md:flex" aria-label="Navigation principale">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `text-sm transition hover:text-brand ${isActive ? 'text-brand' : 'text-ink/75'}`
                }
              >
                {item.label}
              </NavLink>
            ))}
            <Link to="/devis" className="btn-primary !px-5 !py-2.5">
              Demander un devis
            </Link>
          </nav>

          <button
            type="button"
            className="md:hidden"
            aria-label={open ? 'Fermer le menu' : 'Ouvrir le menu'}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>

        {open && (
          <nav className="border-t border-line bg-paper px-5 py-4 md:hidden" aria-label="Navigation mobile">
            <ul className="flex flex-col gap-3">
              {NAV.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    onClick={() => setOpen(false)}
                    className="block py-1 text-sm text-ink/80"
                  >
                    {item.label}
                  </NavLink>
                </li>
              ))}
              <li>
                <Link to="/devis" onClick={() => setOpen(false)} className="btn-primary w-full">
                  Demander un devis
                </Link>
              </li>
            </ul>
          </nav>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-line bg-ink text-white">
        <div className="container-x grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-lg font-black">
              5<span className="text-brand">DEV</span>
            </p>
            <p className="mt-2 text-sm text-white/60">{studio?.tagline ?? 'Build. Innovate. Grow.'}</p>
          </div>

          <nav aria-label="Navigation de pied de page">
            <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-white/40">Le studio</p>
            <ul className="space-y-2 text-sm">
              {NAV.map((item) => (
                <li key={item.to}>
                  <Link to={item.to} className="text-white/70 transition hover:text-brand">
                    {item.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link to="/reservation" className="text-white/70 transition hover:text-brand">
                  Réserver une séance photo
                </Link>
              </li>
            </ul>
          </nav>

          <div>
            <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-white/40">Contact</p>
            <ul className="space-y-2 text-sm text-white/70">
              {studio?.email && (
                <li>
                  <a href={`mailto:${studio.email}`} className="hover:text-brand">
                    {studio.email}
                  </a>
                </li>
              )}
              {studio?.phone && (
                <li>
                  <a href={`tel:${studio.phone.replace(/\s/g, '')}`} className="hover:text-brand">
                    {studio.phone}
                  </a>
                </li>
              )}
              {studio?.address && <li className="text-white/50">{studio.address}</li>}
              {studio?.hours && <li className="text-white/50">{studio.hours}</li>}
            </ul>
          </div>

          <div>
            <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-white/40">Démarrer</p>
            <Link to="/devis" className="inline-flex items-center gap-2 text-sm text-brand">
              Décrire mon projet <ArrowUpRight className="size-4" />
            </Link>
            <Link to="/admin" className="mt-4 block text-xs text-white/35 hover:text-white/60">
              Espace administration
            </Link>
          </div>
        </div>
        <div className="border-t border-white/10">
          <div className="container-x flex flex-col gap-2 py-5 text-xs text-white/35 sm:flex-row sm:justify-between">
            <span>© {new Date().getFullYear()} 5DEV — Tous droits réservés.</span>
            <span>5dev.com</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
