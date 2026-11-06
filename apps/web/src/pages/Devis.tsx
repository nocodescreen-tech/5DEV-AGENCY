import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { apiGet, apiPost, ApiRequestError } from '../lib/api';
import type { Category, Service } from '../lib/types';
import { useToast } from '../components/Toaster';
import { money } from '../lib/format';

type Form = {
  service_slug: string;
  budget_amount: string;
  budget_currency: 'USD' | 'CDF';
  message: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  website: string;
};

const STEPS = ['Besoin', 'Budget', 'Coordonnées'];

export default function Devis() {
  const [params] = useSearchParams();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<Form>({
    service_slug: params.get('service') ?? '',
    budget_amount: '',
    budget_currency: 'USD',
    message: '',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    website: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [reference, setReference] = useState<string | null>(null);
  const toast = useToast();
  const [sending, setSending] = useState(false);

  const { data } = useQuery({
    queryKey: ['services'],
    queryFn: () => apiGet<{ categories: Category[]; services: Service[] }>('/api/v1/services'),
  });

  const service = useMemo(
    () => (data?.services ?? []).find((s) => s.slug === form.service_slug) ?? null,
    [data, form.service_slug],
  );

  const set = (key: keyof Form, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const canNext = () => {
    if (step === 0) return form.message.trim().length >= 5;
    if (step === 1) return true;
    return form.contact_name.trim().length >= 2 && /.+@.+\..+/.test(form.contact_email);
  };

  async function submit() {
    setSending(true);
    setError(null);
    setFields({});
    try {
      const payload = {
        kind: 'quote' as const,
        contact_name: form.contact_name,
        contact_email: form.contact_email,
        contact_phone: form.contact_phone || undefined,
        service_id: service?.id ?? null,
        budget_amount: form.budget_amount ? Number(form.budget_amount) : null,
        budget_currency: form.budget_currency,
        message: form.message,
      };
      const res = await apiPost<{ reference: string }>('/api/v1/leads', payload);
      setReference(res.reference);
      toast.push('success', `Demande de devis enregistrée — référence ${res.reference}.`);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
        setFields(err.fields ?? {});
      } else {
        setError('Envoi impossible. Réessayez dans un instant.');
      }
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
          <h1 className="mt-5 text-2xl font-black">Demande envoyée</h1>
          <p className="mt-3 text-sm text-ink/65">
            Référence <strong className="font-mono">{reference}</strong>. Réponse sous 48 heures
            ouvrées à l’adresse indiquée.
          </p>
          <Link to="/" className="btn-ghost mt-7">
            Retour à l’accueil
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container-x py-14 sm:py-20">
      <div className="mx-auto max-w-2xl">
        <p className="eyebrow">Devis</p>
        <h1 className="mt-3 text-3xl font-black sm:text-4xl">Décrivez votre projet</h1>
        <p className="mt-3 text-sm text-ink/60">
          Trois étapes, deux minutes. Aucun compte à créer.
        </p>

        {/* progression */}
        <ol className="mt-8 flex items-center gap-2" aria-label="Progression">
          {STEPS.map((label, i) => (
            <li key={label} className="flex flex-1 items-center gap-2">
              <span
                className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold ${
                  i <= step ? 'bg-brand text-white' : 'bg-line text-muted'
                }`}
                aria-current={i === step ? 'step' : undefined}
              >
                {i + 1}
              </span>
              <span className={`text-xs ${i === step ? 'font-semibold' : 'text-muted'}`}>{label}</span>
              {i < STEPS.length - 1 && <span className="h-px flex-1 bg-line" aria-hidden />}
            </li>
          ))}
        </ol>

        <div className="mt-8 card p-6 sm:p-8">
          {step === 0 && (
            <div className="space-y-5">
              <div>
                <label className="label" htmlFor="service">
                  Service concerné
                </label>
                <select
                  id="service"
                  className="field"
                  value={form.service_slug}
                  onChange={(e) => set('service_slug', e.target.value)}
                >
                  <option value="">Je ne sais pas encore</option>
                  {(data?.categories ?? []).map((cat) => (
                    <optgroup key={cat.id} label={cat.name}>
                      {(data?.services ?? [])
                        .filter((s) => s.category_id === cat.id)
                        .map((s) => (
                          <option key={s.id} value={s.slug}>
                            {s.title}
                          </option>
                        ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              <div>
                <label className="label" htmlFor="message">
                  Décrivez le besoin *
                </label>
                <textarea
                  id="message"
                  className="field min-h-32"
                  value={form.message}
                  onChange={(e) => set('message', e.target.value)}
                  placeholder="Contexte, objectif, ce que vous attendez concrètement…"
                  aria-invalid={Boolean(fields.message)}
                />
                {fields.message && <p className="mt-1 text-xs text-brand">{fields.message}</p>}
                <p className="mt-1 text-xs text-muted">{form.message.length} / 4000 caractères</p>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <div className="grid grid-cols-[1fr_auto] gap-3">
                <div>
                  <label className="label" htmlFor="budget">
                    Budget indicatif (facultatif)
                  </label>
                  <input
                    id="budget"
                    className="field"
                    inputMode="numeric"
                    value={form.budget_amount}
                    onChange={(e) => set('budget_amount', e.target.value.replace(/[^\d]/g, ''))}
                    placeholder="ex. 800"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="currency">
                    Devise
                  </label>
                  <select
                    id="currency"
                    className="field"
                    value={form.budget_currency}
                    onChange={(e) => set('budget_currency', e.target.value)}
                  >
                    <option value="USD">USD</option>
                    <option value="CDF">CDF</option>
                  </select>
                </div>
              </div>
              <p className="text-xs text-muted">
                Un budget annoncé permet de proposer un périmètre réaliste. Il reste indicatif :
                le devis final est établi après cadrage.
              </p>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="name">
                    Nom complet *
                  </label>
                  <input
                    id="name"
                    className="field"
                    value={form.contact_name}
                    onChange={(e) => set('contact_name', e.target.value)}
                    aria-invalid={Boolean(fields.contact_name)}
                  />
                  {fields.contact_name && (
                    <p className="mt-1 text-xs text-brand">{fields.contact_name}</p>
                  )}
                </div>
                <div>
                  <label className="label" htmlFor="email">
                    Email *
                  </label>
                  <input
                    id="email"
                    type="email"
                    className="field"
                    value={form.contact_email}
                    onChange={(e) => set('contact_email', e.target.value)}
                    aria-invalid={Boolean(fields.contact_email)}
                  />
                  {fields.contact_email && (
                    <p className="mt-1 text-xs text-brand">{fields.contact_email}</p>
                  )}
                </div>
              </div>
              <div>
                <label className="label" htmlFor="phone">
                  Téléphone / WhatsApp
                </label>
                <input
                  id="phone"
                  className="field"
                  value={form.contact_phone}
                  onChange={(e) => set('contact_phone', e.target.value)}
                  placeholder="+243 …"
                />
              </div>

              {/* honeypot invisible */}
              <input
                tabIndex={-1}
                autoComplete="off"
                className="hidden"
                value={form.website}
                onChange={(e) => set('website', e.target.value)}
                aria-hidden="true"
              />

              <div className="rounded-lg bg-wash p-4 text-sm">
                <p className="font-medium">Récapitulatif</p>
                <ul className="mt-2 space-y-1 text-ink/70">
                  <li>Service : {service?.title ?? 'à définir ensemble'}</li>
                  <li>
                    Budget :{' '}
                    {form.budget_amount
                      ? money(Number(form.budget_amount), form.budget_currency)
                      : 'non précisé'}
                  </li>
                  <li className="line-clamp-2">Besoin : {form.message || '—'}</li>
                </ul>
              </div>
            </div>
          )}

          {error && (
            <p role="alert" className="mt-5 rounded-lg border border-brand/40 bg-brand/5 p-3 text-sm">
              {error}
            </p>
          )}

          <div className="mt-7 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
              className="btn-ghost disabled:opacity-40"
            >
              <ArrowLeft className="size-4" /> Retour
            </button>

            {step < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={() => setStep((s) => s + 1)}
                disabled={!canNext()}
                className="btn-primary disabled:opacity-40"
              >
                Continuer <ArrowRight className="size-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void submit()}
                disabled={!canNext() || sending}
                className="btn-primary disabled:opacity-40"
              >
                {sending ? 'Envoi…' : 'Envoyer la demande'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
