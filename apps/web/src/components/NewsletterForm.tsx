import { useState } from 'react';
import { apiPost, ApiRequestError } from '../lib/api';

/** Inscription newsletter (double opt-in) — utilisée dans le pied de page. */
export default function NewsletterForm() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState('sending');
    try {
      const res = await apiPost<{ status: string; emailSent: boolean; confirmUrl?: string }>(
        '/api/v1/newsletter/subscribe',
        { email },
      );
      setState('done');
      setMessage(
        res.emailSent
          ? 'Vérifiez votre boîte mail : un lien de confirmation vient d’être envoyé.'
          : 'Inscription enregistrée. La confirmation par email n’a pas pu être envoyée : contactez le studio.',
      );
      setEmail('');
    } catch (err) {
      setState('error');
      setMessage(err instanceof ApiRequestError ? err.message : 'Inscription impossible pour le moment.');
    }
  }

  return (
    <form onSubmit={submit} className="mt-3">
      <label htmlFor="nl-email" className="mb-1.5 block text-xs text-white/50">
        Recevoir les nouveautés (double confirmation par email)
      </label>
      <div className="flex gap-2">
        <input
          id="nl-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="vous@exemple.com"
          className="w-full rounded-lg border border-white/15 bg-transparent px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-brand focus:outline-none"
        />
        <button
          type="submit"
          disabled={state === 'sending'}
          className="shrink-0 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {state === 'sending' ? '…' : 'S’inscrire'}
        </button>
      </div>
      {message && (
        <p className={`mt-2 text-xs ${state === 'error' ? 'text-brand' : 'text-white/60'}`} role="status">
          {message}
        </p>
      )}
    </form>
  );
}
