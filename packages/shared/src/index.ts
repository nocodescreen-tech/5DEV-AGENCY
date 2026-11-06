/**
 * Types et constantes partagés entre l'API et le web.
 * Aucune dépendance : ce paquet doit rester importable des deux côtés.
 */

export const APP = {
  name: '5DEV',
  claim: 'Build. Innovate. Grow.',
  domain: '5dev.com',
  whatsapp: '+243891755172',
  email: 'mio.appservice@gmail.com',
} as const;

export const CURRENCIES = ['USD', 'CDF'] as const;
export type Currency = (typeof CURRENCIES)[number];

export const POLES = [
  { slug: 'web-development', label: 'Développement web' },
  { slug: 'digital-solutions', label: 'Solutions digitales' },
  { slug: 'digital-growth', label: 'Croissance digitale' },
  { slug: 'creative-photography', label: 'Photographie créative' },
] as const;
export type PoleSlug = (typeof POLES)[number]['slug'];

/** Réponse normalisée de l'API (succès). */
export type ApiOk<T> = {
  ok: true;
  data: T;
  meta?: { page?: number; limit?: number; total?: number };
};

/** Réponse normalisée de l'API (échec). */
export type ApiError = {
  ok: false;
  error: {
    code: string;
    message: string;
    fields?: Record<string, string>;
  };
};

export type HealthPayload = {
  service: string;
  version: string;
  uptimeSeconds: number;
  database: 'up' | 'down' | 'not_configured';
  timestamp: string;
};

/** Formate une durée en secondes pour l'affichage (ex. 3725 → « 1 h 2 min »). */
export function formatUptime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  if (s < 60) return `${s} s`;
  const minutes = Math.floor(s / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}
