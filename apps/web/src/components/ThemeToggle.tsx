import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme, type ThemeMode } from '../lib/theme';

const ORDER: ThemeMode[] = ['light', 'system', 'dark'];

const LABEL: Record<ThemeMode, string> = {
  light: 'Thème clair',
  dark: 'Thème sombre',
  system: 'Thème du système',
};

/** Bascule clair → système → sombre, avec libellé accessible. */
export default function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme } = useTheme();
  const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length] ?? 'system';
  const Icon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor;

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      title={`${LABEL[theme]} — cliquer pour ${LABEL[next].toLowerCase()}`}
      aria-label={`${LABEL[theme]}. Passer au ${LABEL[next].toLowerCase()}.`}
      className={
        compact
          ? 'grid size-9 place-items-center rounded-lg border border-line text-ink/70 transition hover:border-brand hover:text-brand'
          : 'inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-xs text-ink/70 transition hover:border-brand hover:text-brand'
      }
    >
      <Icon className="size-4" aria-hidden />
      {!compact && <span>{theme === 'system' ? 'Auto' : theme === 'dark' ? 'Sombre' : 'Clair'}</span>}
    </button>
  );
}
