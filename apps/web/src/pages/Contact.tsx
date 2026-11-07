import { useMemo, useState } from 'react';
import { Mail, MapPin, MessageCircle, Phone, Send } from 'lucide-react';
import { apiPost, ApiRequestError } from '../lib/api';
import { useSettings } from '../components/SiteLayout';
import { useToast } from '../components/Toaster';
import { rules, useFormValidation, type Schema } from '../lib/form-validation';

import { SplitText } from '../components/motion/SplitText';
import { Magnetic } from '../components/motion/Magnetic';
type Form = { contact_name: string; contact_email: string; contact_phone: string; message: string };

const SCHEMA: Schema<Form> = {
  contact_name: [rules.required('Le nom'), rules.min(2, 'Le nom')],
  contact_email: [rules.required('L’email'), rules.email()],
  contact_phone: [rules.phone()],
  message: [rules.required('Le message'), rules.min(15, 'Le message')],
};

export default function Contact() {
  const studio = useSettings()?.studio;
  const toast = useToast();

  const [form, setForm] = useState<Form>({ contact_name: '', contact_email: '', contact_phone: '', message: '' });
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [shake, setShake] = useState(false);

  const schema = useMemo(() => SCHEMA, []);
  const { visibleError, isValidField, onBlur, validateAll } = useFormValidation(form, schema);

  const set = (key: keyof Form, value: string) => setForm((f) => ({ ...f, [key]: value }));

  async function submit() {
    setError(null);
    if (!validateAll()) {
      setShake(true);
      window.setTimeout(() => setShake(false), 400);
      // on amène l'utilisateur sur le premier champ en défaut
      const firstInvalid = (['contact_name', 'contact_email', 'message'] as (keyof Form)[]).find(
        (k) => !form[k].trim(),
      );
      if (firstInvalid) document.getElementById(`c-${firstInvalid === 'contact_name' ? 'name' : firstInvalid === 'contact_email' ? 'email' : 'message'}`)?.focus();
      return;
    }

    setSending(true);
    try {
      const res = await apiPost<{ reference: string }>('/api/v1/leads', {
        kind: 'contact',
        ...form,
      });
      setSent(res.reference);
      setForm({ contact_name: '', contact_email: '', contact_phone: '', message: '' });
      toast.push('success', 'Message envoyé. On vous répond sous 48 h ouvrées.');
    } catch (err) {
      const message =
        err instanceof ApiRequestError
          ? err.status === 429
            ? 'Trop de messages envoyés depuis cette connexion. Réessayez dans quelques minutes.'
            : err.message
          : 'Envoi impossible pour le moment.';
      setError(message);
      toast.push('error', message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="container-x py-14 sm:py-20">
      <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <p className="eyebrow rule-in">Contact</p>
          <SplitText
            as="h1"
            text="Dites-nous ce qui vous amène."
            scramble
            step={0.06}
            className="mt-3 text-4xl font-black leading-tight sm:text-5xl"
          />
          <p className="mt-5 max-w-md text-lg text-ink/65">
            Deux lignes suffisent pour commencer. On lit chaque message et on répond sous 48 heures
            ouvrées — sans engagement, et sans discours de vente.
          </p>

          <ul className="mt-10 space-y-4 text-sm">
            {studio?.email && (
              <li className="flex items-start gap-3">
                <Mail className="mt-0.5 size-4 text-brand" aria-hidden />
                <a href={`mailto:${studio.email}`} className="link-anim hover:text-brand">
                  {studio.email}
                </a>
              </li>
            )}
            {studio?.phone && (
              <li className="flex items-start gap-3">
                <Phone className="mt-0.5 size-4 text-brand" aria-hidden />
                <a href={`tel:${studio.phone.replace(/\s/g, '')}`} className="link-anim hover:text-brand">
                  {studio.phone}
                </a>
              </li>
            )}
            {studio?.whatsapp && (
              <li className="flex items-start gap-3">
                <MessageCircle className="mt-0.5 size-4 text-brand" aria-hidden />
                <a
                  href={`https://wa.me/${studio.whatsapp.replace(/[^\d]/g, '')}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="link-anim hover:text-brand"
                >
                  WhatsApp
                </a>
              </li>
            )}
            <li className="flex items-start gap-3">
              <MapPin className="mt-0.5 size-4 text-brand" aria-hidden />
              <span className="text-ink/70">Matadi, République démocratique du Congo</span>
            </li>
          </ul>
        </div>

        <div className={`card p-6 sm:p-8 ${shake ? 'shake' : ''}`}>
          {sent ? (
            <div className="anim-rise text-center">
              <div className="mx-auto grid size-12 place-items-center rounded-full bg-brand/10">
                <Send className="size-5 text-brand" aria-hidden />
              </div>
              <h2 className="mt-4 text-xl font-black">Message reçu.</h2>
              <p className="mt-2 text-sm text-ink/65">
                Référence <span className="font-mono font-semibold">{sent}</span>. On vous répond sous
                48 heures ouvrées.
              </p>
              <button type="button" onClick={() => setSent(null)} className="btn-ghost mt-6 !py-2.5">
                Envoyer un autre message
              </button>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
              noValidate
            >
              <h2 className="text-xl font-black">Écrire à 5DEV</h2>
              <p className="mt-1 text-sm text-ink/60">Les champs marqués * sont nécessaires pour vous répondre.</p>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <Field
                  id="c-name"
                  label="Nom complet *"
                  value={form.contact_name}
                  onChange={(v) => set('contact_name', v)}
                  onBlur={() => onBlur('contact_name')}
                  error={visibleError('contact_name')}
                  valid={isValidField('contact_name')}
                  autoComplete="name"
                />
                <Field
                  id="c-email"
                  label="Email *"
                  type="email"
                  value={form.contact_email}
                  onChange={(v) => set('contact_email', v)}
                  onBlur={() => onBlur('contact_email')}
                  error={visibleError('contact_email')}
                  valid={isValidField('contact_email')}
                  autoComplete="email"
                />
              </div>

              <div className="mt-4">
                <Field
                  id="c-phone"
                  label="Téléphone / WhatsApp"
                  value={form.contact_phone}
                  onChange={(v) => set('contact_phone', v)}
                  onBlur={() => onBlur('contact_phone')}
                  error={visibleError('contact_phone')}
                  valid={isValidField('contact_phone')}
                  autoComplete="tel"
                  hint="Facultatif — utile si vous préférez un appel."
                />
              </div>

              <div className="mt-4">
                <label className="label" htmlFor="c-message">
                  Votre message *
                </label>
                <textarea
                  id="c-message"
                  className="field min-h-32"
                  value={form.message}
                  onChange={(e) => set('message', e.target.value)}
                  onBlur={() => onBlur('message')}
                  aria-invalid={Boolean(visibleError('message'))}
                  aria-describedby={visibleError('message') ? 'err-message' : undefined}
                />
                {visibleError('message') && (
                  <p id="err-message" role="alert" className="mt-1.5 text-xs text-brand">
                    {visibleError('message')}
                  </p>
                )}
                <p className="mt-1.5 text-[11px] text-muted">{form.message.trim().length} caractère(s)</p>
              </div>

              {error && (
                <p role="alert" className="mt-4 rounded-lg border border-brand/40 bg-brand/5 p-3 text-sm">
                  {error}
                </p>
              )}

              <Magnetic className="mt-6 w-full" strength={6}>
              <button type="submit" disabled={sending} className="btn-primary btn-motion mt-6 w-full disabled:opacity-60">
                {sending ? (
                  <>
                    <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden />
                    Envoi…
                  </>
                ) : (
                  <>
                    <Send className="size-4" aria-hidden /> Envoyer le message
                  </>
                )}
              </button>
              </Magnetic>
              <p className="mt-3 text-center text-[11px] text-muted">
                Vos coordonnées ne servent qu’à vous répondre. Aucun ajout automatique à une liste.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  onBlur,
  error,
  valid,
  type = 'text',
  autoComplete,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  error?: string;
  valid?: boolean;
  type?: string;
  autoComplete?: string;
  hint?: string;
}) {
  return (
    <div>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={type}
          className={`field ${valid ? 'border-emerald-400/70' : ''}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          autoComplete={autoComplete}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `err-${id}` : undefined}
        />
        {valid && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-emerald-600" aria-hidden>
            ✓
          </span>
        )}
      </div>
      {error ? (
        <p id={`err-${id}`} role="alert" className="mt-1.5 text-xs text-brand">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-[11px] text-muted">{hint}</p>
      ) : null}
    </div>
  );
}
