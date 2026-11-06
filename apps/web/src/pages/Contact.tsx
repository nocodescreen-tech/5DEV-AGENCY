import { useState } from 'react';
import { Check, Mail, MapPin, Phone } from 'lucide-react';
import { apiPost, ApiRequestError } from '../lib/api';
import { useSettings } from '../components/SiteLayout';

export default function Contact() {
  const { data } = useSettings();
  const studio = data?.studio;
  const [form, setForm] = useState({ contact_name: '', contact_email: '', contact_phone: '', message: '' });
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const valid = form.contact_name.trim().length >= 2 && /.+@.+\..+/.test(form.contact_email) && form.message.trim().length >= 5;

  async function submit() {
    setSending(true);
    setError(null);
    try {
      const res = await apiPost<{ reference: string }>('/api/v1/leads', {
        kind: 'contact',
        ...form,
      });
      setSent(res.reference);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Envoi impossible.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="container-x py-14 sm:py-20">
      <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <p className="eyebrow">Contact</p>
          <h1 className="mt-3 text-4xl font-black leading-tight sm:text-5xl">Parlons de votre projet.</h1>
          <p className="mt-5 max-w-md text-lg text-ink/65">
            Un message suffit. Réponse sous 48 heures ouvrées, sans engagement.
          </p>

          <ul className="mt-10 space-y-4 text-sm">
            {studio?.email && (
              <li className="flex items-start gap-3">
                <Mail className="mt-0.5 size-4 text-brand" aria-hidden />
                <a href={`mailto:${studio.email}`} className="hover:text-brand">
                  {studio.email}
                </a>
              </li>
            )}
            {studio?.phone && (
              <li className="flex items-start gap-3">
                <Phone className="mt-0.5 size-4 text-brand" aria-hidden />
                <a href={`tel:${studio.phone.replace(/\s/g, '')}`} className="hover:text-brand">
                  {studio.phone}
                </a>
              </li>
            )}
            {studio?.whatsapp && (
              <li className="flex items-start gap-3">
                <Phone className="mt-0.5 size-4 text-brand" aria-hidden />
                <a
                  href={`https://wa.me/${studio.whatsapp.replace(/[^\d]/g, '')}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="hover:text-brand"
                >
                  WhatsApp
                </a>
              </li>
            )}
            {studio?.address && (
              <li className="flex items-start gap-3">
                <MapPin className="mt-0.5 size-4 text-brand" aria-hidden />
                <span className="text-ink/70">{studio.address}</span>
              </li>
            )}
          </ul>
          {studio?.hours && <p className="mt-6 text-xs uppercase tracking-wider text-muted">{studio.hours}</p>}
        </div>

        <div className="card p-6 sm:p-8">
          {sent ? (
            <div className="py-8 text-center">
              <span className="mx-auto grid size-12 place-items-center rounded-full bg-brand/10 text-brand">
                <Check className="size-6" />
              </span>
              <h2 className="mt-5 text-xl font-bold">Message envoyé</h2>
              <p className="mt-2 text-sm text-ink/65">
                Référence <strong className="font-mono">{sent}</strong>. Nous revenons vers vous rapidement.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="c-name">
                    Nom complet *
                  </label>
                  <input
                    id="c-name"
                    className="field"
                    value={form.contact_name}
                    onChange={(e) => set('contact_name', e.target.value)}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="c-email">
                    Email *
                  </label>
                  <input
                    id="c-email"
                    type="email"
                    className="field"
                    value={form.contact_email}
                    onChange={(e) => set('contact_email', e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="label" htmlFor="c-phone">
                  Téléphone / WhatsApp
                </label>
                <input
                  id="c-phone"
                  className="field"
                  value={form.contact_phone}
                  onChange={(e) => set('contact_phone', e.target.value)}
                />
              </div>
              <div>
                <label className="label" htmlFor="c-message">
                  Votre message *
                </label>
                <textarea
                  id="c-message"
                  className="field min-h-32"
                  value={form.message}
                  onChange={(e) => set('message', e.target.value)}
                />
              </div>
              {error && (
                <p role="alert" className="rounded-lg border border-brand/40 bg-brand/5 p-3 text-sm">
                  {error}
                </p>
              )}
              <button
                type="button"
                onClick={() => void submit()}
                disabled={!valid || sending}
                className="btn-primary w-full disabled:opacity-40"
              >
                {sending ? 'Envoi…' : 'Envoyer le message'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
