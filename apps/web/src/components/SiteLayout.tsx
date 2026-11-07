import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Menu, X } from 'lucide-react';
import { apiGet } from '../lib/api';
import type { Settings } from '../lib/types';
import NewsletterForm from './NewsletterForm';
import ThemeToggle from './ThemeToggle';
import { ScrollProgress } from './motion/ScrollProgress';
import { PageTransition } from './motion/PageTransition';
import { Magnetic } from './motion/Magnetic';

const NAV = [
  { to: '/', label: 'Accueil', end: true },
  { to: '/services', label: 'Services' },
  { to: '/realisations', label: 'Réalisations' },
  { to: '/a-propos', label: 'Agence' },
  { to: '/reservation', label: 'Photographie' },
  { to: '/contact', label: 'Contact' },
];

export function useSettings() {
  const { data } = useQuery({
    queryKey: ['settings'],
    queryFn: () => apiGet<Settings>('/api/v1/settings'),
    staleTime: 300_000,
  });
  return data;
}

export default function SiteLayout() {
  const settings = useSettings();
  const studio = settings?.studio;
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const navRef = useRef<HTMLElement | null>(null);
  const [indicator, setIndicator] = useState({ x: 0, w: 0, visible: false });

  useEffect(() => setOpen(false), [location.pathname]);

  // en-tête condensé au défilement (la progression de lecture est gérée par ScrollProgress)
  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        setScrolled(window.scrollY > 12);
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  // indicateur glissant : on mesure le lien actif réel, jamais une position devinée
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const measure = () => {
      const active = nav.querySelector<HTMLAnchorElement>('[aria-current="page"]');
      if (!active) {
        setIndicator((i) => ({ ...i, visible: false }));
        return;
      }
      setIndicator({ x: active.offsetLeft, w: active.offsetWidth, visible: true });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(nav);
    return () => ro.disconnect();
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <ScrollProgress />

      <header
        className={`site-header sticky top-0 z-40 ${
          scrolled ? 'is-scrolled border-b border-line bg-paper/85 backdrop-blur-md' : 'border-b border-transparent bg-transparent'
        }`}
      >
        <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-between gap-4 px-5">
          <Link to="/" className="flex items-baseline gap-1.5" aria-label="5DEV, accueil">
            <span className="text-xl font-black tracking-tight"><span className="text-brand">5</span>DEV</span>
            <span className="mt-0.5 size-1.5 rounded-full bg-brand" aria-hidden />
          </Link>

          <nav ref={navRef} className="nav-list hidden items-center gap-7 md:flex" aria-label="Navigation principale">
            <span
              className="nav-indicator"
              aria-hidden
              style={{
                opacity: indicator.visible ? 1 : 0,
                width: `${indicator.w}px`,
                transform: `translateX(${indicator.x}px)`,
              }}
            />
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                viewTransition
                className={({ isActive }) => `nav-item text-sm ${isActive ? 'font-semibold text-ink' : 'text-ink/70'}`}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle compact />
            <Magnetic className="hidden sm:inline-flex" strength={6}>
              <Link to="/devis" className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand">
                Devis
              </Link>
            </Magnetic>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="rounded-md p-2 md:hidden"
              aria-expanded={open}
              aria-controls="menu-mobile"
              aria-label={open ? 'Fermer le menu' : 'Ouvrir le menu'}
            >
              {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
            </button>
          </div>
        </div>

        <div
          id="menu-mobile"
          className={`mobile-menu overflow-hidden border-t border-line bg-paper transition-[grid-template-rows] duration-300 md:hidden ${
            open ? 'is-open grid grid-rows-[1fr]' : 'grid grid-rows-[0fr]'
          }`}
          aria-hidden={!open}
        >
          <div className="overflow-hidden">
            <ul className="mx-auto max-w-[1240px] px-5 py-3">
              {NAV.map((item, i) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    viewTransition
                    style={{ ['--i' as string]: i }}
                    className={({ isActive }) =>
                      `mobile-link block border-b border-line/60 py-3 text-sm ${isActive ? 'font-semibold text-brand' : ''}`
                    }
                  >
                    {item.label}
                  </NavLink>
                </li>
              ))}
              <li className="pt-4">
                <Link to="/devis" className="btn-primary w-full justify-center">
                  Demander un devis <ArrowUpRight className="size-4" aria-hidden />
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <PageTransition>
          <Outlet />
        </PageTransition>
      </main>

      <footer className="border-t border-line bg-ink text-white">
        <div className="mx-auto grid max-w-[1240px] gap-10 px-5 py-14 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-lg font-black">
              <span className="text-brand">5</span>DEV<span className="text-brand">.</span>
            </p>
            <p className="mt-3 max-w-[30ch] text-sm leading-relaxed text-white/60">
              Agence numérique basée à Matadi. Développement web, solutions digitales, croissance et
              photographie.
            </p>
            <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.2em] text-brand">
              Build. Innovate. Grow.
            </p>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wider text-white/40">L’agence</p>
            <ul className="mt-3 space-y-2 text-sm text-white/70">
              {NAV.filter((n) => n.to !== '/').map((n) => (
                <li key={n.to}>
                  <Link to={n.to} className="transition hover:text-brand">
                    {n.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link to="/devis" className="transition hover:text-brand">
                  Demander un devis
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wider text-white/40">Contact</p>
            <ul className="mt-3 space-y-2 text-sm text-white/70">
              {studio?.email && (
                <li>
                  <a href={`mailto:${studio.email}`} className="transition hover:text-brand">
                    {studio.email}
                  </a>
                </li>
              )}
              {studio?.whatsapp && (
                <li>
                  <a
                    href={`https://wa.me/${studio.whatsapp.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="transition hover:text-brand"
                  >
                    WhatsApp {studio.whatsapp}
                  </a>
                </li>
              )}
              {studio?.address && <li className="text-white/50">{studio.address}</li>}
            </ul>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wider text-white/40">Lettre de 5DEV</p>
            <NewsletterForm />

          </div>
        </div>

        <div className="border-t border-white/10">
          <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-3 px-5 py-5 text-[11px] text-white/40">
            <p>© {new Date().getFullYear()} 5DEV. Tous droits réservés.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
