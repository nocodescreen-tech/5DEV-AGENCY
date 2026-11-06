/** Formatage monétaire USD/CDF + dates en français. */

const nfUsd = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const nfCdf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

/** Affiche un prix : « 250 USD » / « 700 000 CDF », ou « Sur devis ». */
export function money(amount: number | string | null | undefined, currency: 'USD' | 'CDF'): string {
  if (amount === null || amount === undefined || amount === '') return 'Sur devis';
  const n = typeof amount === 'string' ? Number(amount) : amount;
  if (!Number.isFinite(n)) return 'Sur devis';
  return currency === 'USD' ? `${nfUsd.format(n)} USD` : `${nfCdf.format(n)} CDF`;
}

/** Conversion indicative à partir du taux administré (jamais utilisée pour facturer). */
export function convert(amountUsd: number, rate: number): number {
  return Math.round(amountUsd * rate);
}

export function frDate(value: string | null | undefined): string {
  if (!value) return '';
  const d = new Date(value.length <= 10 ? `${value}T12:00:00` : value);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }).format(d);
}

export function frDateTime(value: string | null | undefined): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 70);
}
