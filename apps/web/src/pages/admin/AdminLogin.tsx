import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { apiPost, ApiRequestError } from '../../lib/api';

export default function AdminLogin() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      await apiPost('/api/v1/auth/login', { email, password });
      await qc.invalidateQueries({ queryKey: ['me'] });
      navigate('/admin', { replace: true });
    } catch (err) {
      setError(
        err instanceof ApiRequestError && err.status === 401
          ? 'Identifiants invalides.'
          : 'Connexion impossible. Réessayez.',
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-ink p-12 text-white lg:flex">
        <Link to="/" className="text-xl font-black">
          5<span className="text-brand">DEV</span>
        </Link>
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-brand">Studio management</p>
          <h1 className="mt-4 text-4xl font-black leading-tight">
            L’espace de travail
            <br />
            du studio.
          </h1>
          <p className="mt-4 max-w-sm text-sm text-white/60">
            Demandes, réservations, catalogue et réglages du site. Accès réservé.
          </p>
        </div>
        <p className="text-xs text-white/35">5dev.com</p>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-12">
        <form onSubmit={submit} className="w-full max-w-sm">
          <h2 className="text-2xl font-black">Connexion</h2>
          <p className="mt-2 text-sm text-ink/60">Identifiants administrateur requis.</p>

          <div className="mt-8 space-y-4">
            <div>
              <label className="label" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="username"
                required
                className="field"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="password">
                Mot de passe
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                minLength={8}
                className="field"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <p role="alert" className="mt-4 rounded-lg border border-brand/40 bg-brand/5 p-3 text-sm">
              {error}
            </p>
          )}

          <button type="submit" disabled={sending} className="btn-primary mt-6 w-full disabled:opacity-50">
            {sending ? 'Connexion…' : 'Entrer'}
          </button>

          <Link to="/" className="mt-6 block text-center text-xs text-muted hover:text-brand">
            Retour au site
          </Link>
        </form>
      </div>
    </div>
  );
}
