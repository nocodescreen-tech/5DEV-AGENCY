import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { apiGet, apiPost, ApiRequestError } from '../lib/api';
import type { Category, Service } from '../lib/types';
import { frDate } from '../lib/format';

type Slot = { slot: 'morning' | 'afternoon' | 'evening'; label: string; available: boolean };

const today = () => new Date().toISOString().slice(0, 10);

export default function Reservation() {
  const [date, setDate] = useState(today());
  const [slot, setSlot] = useState<'' | 'morning' | 'afternoon' | 'evening'>('');
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    location: '',
    notes: '',
    service_slug: '',
  });
  const [reference, setReference] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const { data: catalog } = useQuery({
    queryKey: ['services'],
    queryFn: () => apiGet<{ categories: Category[]; services: Service[] }>('/api/v1/services'),
  });

  const photoCategory = (catalog?.categories ?? []).find((c) => c.slug === 'creative-photography');
  const photoServices = (catalog?.services ?? []).filter((s) => s.category_id === photoCategory?.id);

  const { data: availability, isFetching } = useQuery({
    queryKey: ['availability', date],
    queryFn: () => apiGet<{ date: string; slots: Slot[] }>(`/api/v1/bookings/availability?date=${date}`),
    enabled: /^\d{4}-\d{2}-\d{2}$/.test(date),
  });

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit() {
    setSending(true);
    setError(null);
    try {
      const service = photoServices.find((s) => s.slug === form.service_slug);
      const res = await apiPost<{ reference: string }>('/api/v1/bookings', {
        service_id: service?.id ?? null,
        full_name: form.full_name,
        email: form.email,
        phone: form.phone || undefined,
        shoot_date: date,
        slot,
        location: form.location || undefined,
        notes: form.notes || undefined,
      });
      setReference(res.reference);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Réservation impossible pour le moment.');
    } finally {
      setSending(false);
    }
  }

  if (reference) {
    return (
      <div className="container-x py-20">
        <div className="mx-auto max-w-xl rounded-2xl border border-line p-8 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-full bg-brand/10 text-brand">
            <Check className="size-6" />
          </span>
          <h1 className="mt-5 text-2xl font-black">Demande de réservation enregistrée</h1>
          <p className="mt-3 text-sm text-ink/65">
            Référence <strong className="font-mono">{reference}</strong> — {frDate(date)},{' '}
            {slot === 'morning' ? 'matin' : slot === 'afternoon' ? 'après-midi' : 'soirée'}.
            Le studio confirme le créneau par téléphone ou WhatsApp.
          </p>
          <Link to="/" className="btn-ghost mt-7">
            Retour à l’accueil
          </Link>
        </div>
      </div>
    );
  }

  const canSubmit =
    form.full_name.trim().length >= 2 && /.+@.+\..+/.test(form.email) && Boolean(slot) && !sending;

  return (
    <div className="container-x py-14 sm:py-20">
      <div className="mx-auto max-w-2xl">
        <p className="eyebrow">Photographie</p>
        <h1 className="mt-3 text-3xl font-black sm:text-4xl">Réserver une séance</h1>
        <p className="mt-3 text-sm text-ink/60">
          Choisissez une date et un créneau. Un créneau déjà réservé n’est pas proposé.
        </p>

        <div className="mt-8 space-y-6 card p-6 sm:p-8">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="date">
                Date de la séance
              </label>
              <input
                id="date"
                type="date"
                className="field"
                min={today()}
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  setSlot('');
                }}
              />
            </div>
            <div>
              <label className="label" htmlFor="service">
                Prestation
              </label>
              <select
                id="service"
                className="field"
                value={form.service_slug}
                onChange={(e) => set('service_slug', e.target.value)}
              >
                <option value="">À définir</option>
                {photoServices.map((s) => (
                  <option key={s.id} value={s.slug}>
                    {s.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <fieldset>
            <legend className="label">Créneau {isFetching && <span className="text-muted">(vérification…)</span>}</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {(availability?.slots ?? []).map((s) => (
                <button
                  key={s.slot}
                  type="button"
                  disabled={!s.available}
                  onClick={() => setSlot(s.slot)}
                  aria-pressed={slot === s.slot}
                  className={`rounded-lg border px-3 py-3 text-left text-xs transition ${
                    slot === s.slot
                      ? 'border-brand bg-brand/10 text-ink'
                      : s.available
                        ? 'border-line hover:border-ink/30'
                        : 'cursor-not-allowed border-line bg-wash text-muted line-through'
                  }`}
                >
                  {s.label}
                  <span className="mt-1 block text-[11px] text-muted">
                    {s.available ? 'disponible' : 'déjà réservé'}
                  </span>
                </button>
              ))}
              {!availability && !isFetching && (
                <p className="text-xs text-muted">Sélectionnez une date pour voir les créneaux.</p>
              )}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="full_name">
                Nom complet *
              </label>
              <input
                id="full_name"
                className="field"
                value={form.full_name}
                onChange={(e) => set('full_name', e.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="email">
                Email *
              </label>
              <input
                id="email"
                type="email"
                className="field"
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="phone">
                Téléphone / WhatsApp
              </label>
              <input
                id="phone"
                className="field"
                value={form.phone}
                onChange={(e) => set('phone', e.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="location">
                Lieu souhaité
              </label>
              <input
                id="location"
                className="field"
                value={form.location}
                onChange={(e) => set('location', e.target.value)}
                placeholder="Studio, extérieur, domicile…"
              />
            </div>
          </div>

          <div>
            <label className="label" htmlFor="notes">
              Précisions
            </label>
            <textarea
              id="notes"
              className="field min-h-24"
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              placeholder="Nombre de personnes, style, références…"
            />
          </div>

          {error && (
            <p role="alert" className="rounded-lg border border-brand/40 bg-brand/5 p-3 text-sm">
              {error}
            </p>
          )}

          <button
            type="button"
            className="btn-primary w-full disabled:opacity-40"
            disabled={!canSubmit}
            onClick={() => void submit()}
          >
            {sending ? 'Envoi…' : 'Demander ce créneau'}
          </button>
          <p className="text-center text-xs text-muted">
            La réservation est confirmée par le studio. Aucun paiement en ligne à cette étape.
          </p>
        </div>
      </div>
    </div>
  );
}
