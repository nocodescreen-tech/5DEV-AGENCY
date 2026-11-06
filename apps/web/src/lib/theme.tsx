import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

/**
 * Thème clair / sombre / système, persisté localement et côté serveur
 * (user_prefs) pour survivre à une reconnexion sur un autre poste.
 */
export type ThemeMode = 'light' | 'dark' | 'system';
export type Accent = 'orange' | 'amber' | 'rose';
export type Density = 'comfortable' | 'compact';

const KEY = 'five.theme';

type Ctx = {
  theme: ThemeMode;
  resolved: 'light' | 'dark';
  accent: Accent;
  density: Density;
  setTheme: (t: ThemeMode) => void;
  setAccent: (a: Accent) => void;
  setDensity: (d: Density) => void;
};

const ThemeCtx = createContext<Ctx | null>(null);

const ACCENTS: Record<Accent, { main: string; dark: string }> = {
  orange: { main: '#F47721', dark: '#D9610F' },
  amber: { main: '#E4A11B', dark: '#C4860F' },
  rose: { main: '#E2585F', dark: '#C43F46' },
};

function systemPref(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function readPrefs(): { theme: ThemeMode; accent: Accent; density: Density } {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<{ theme: ThemeMode; accent: Accent; density: Density }>;
      return {
        theme: p.theme === 'dark' || p.theme === 'light' || p.theme === 'system' ? p.theme : 'system',
        accent: p.accent === 'amber' || p.accent === 'rose' ? p.accent : 'orange',
        density: p.density === 'compact' ? 'compact' : 'comfortable',
      };
    }
  } catch {
    /* préférences illisibles : valeurs par défaut */
  }
  return { theme: 'system', accent: 'orange', density: 'comfortable' };
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const initial = readPrefs();
  const [theme, setThemeState] = useState<ThemeMode>(initial.theme);
  const [accent, setAccentState] = useState<Accent>(initial.accent);
  const [density, setDensityState] = useState<Density>(initial.density);
  const [system, setSystem] = useState<'light' | 'dark'>(systemPref);

  const resolved: 'light' | 'dark' = theme === 'system' ? system : theme;

  // écoute du thème système (changement en direct)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => setSystem(e.matches ? 'dark' : 'light');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // application au document + persistance locale
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = resolved;
    root.dataset.density = density;
    root.style.setProperty('--brand', ACCENTS[accent].main);
    root.style.setProperty('--brand-600', ACCENTS[accent].dark);
    root.style.colorScheme = resolved;
    try {
      localStorage.setItem(KEY, JSON.stringify({ theme, accent, density }));
    } catch {
      /* stockage indisponible : l'affichage reste correct pour la session */
    }
  }, [resolved, accent, density, theme]);

  const value = useMemo<Ctx>(
    () => ({
      theme,
      resolved,
      accent,
      density,
      setTheme: setThemeState,
      setAccent: setAccentState,
      setDensity: setDensityState,
    }),
    [theme, resolved, accent, density],
  );

  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export function useTheme(): Ctx {
  const ctx = useContext(ThemeCtx);
  if (!ctx) throw new Error('useTheme doit être utilisé dans <ThemeProvider>');
  return ctx;
}
