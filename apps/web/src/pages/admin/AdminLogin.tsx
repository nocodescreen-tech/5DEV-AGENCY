import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, KeyRound, Loader2, ShieldCheck } from 'lucide-react';
import { apiPost, ApiRequestError } from '../../lib/api';

type Challenge = {
  otp_required: true;
  enroll: boolean;
  challenge: string;
  expires_in: number;
  secret?: string;
  otpauth_url?: string;
  instructions?: string;
};

export default function AdminLogin() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const codeRef = useRef<HTMLInputElement | null>(null);

  // compte à rebours du code : informatif, jamais bloquant pour l'utilisateur
  useEffect(() => {
    if (!challenge) return;
    setRemaining(challenge.expires_in);
    const t = window.setInterval(() => setRemaining((r) => (r > 0 ? r - 1 : 0)), 1000);
    return () => window.clearInterval(t);
  }, [challenge]);

  useEffect(() => {
    if (challenge) codeRef.current?.focus();
  }, [challenge]);

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      const res = await apiPost<Challenge>('/api/v1/auth/login', { email, password });
      setChallenge(res);
      setCode('');
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(
          err.status === 401
            ? 'Identifiants invalides.'
            : err.status === 429
              ? 'Trop de tentatives. Réessayez dans quelques minutes.'
              : err.message,
        );
      } else {
        setError('Connexion impossible. Réessayez.');
      }
    } finally {
      setSending(false);
    }
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    if (!challenge) return;
    setSending(true);
    setError(null);
    try {
      await apiPost('/api/v1/auth/login/otp', { challenge: challenge.challenge, code });
      await qc.invalidateQueries({ queryKey: ['me'] });
      navigate('/admin', { replace: true });
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
        if (err.code === 'CHALLENGE_EXPIRED' || err.code === 'CHALLENGE_INVALID') {
          setChallenge(null);
          setCode('');
        }
        if (err.code === 'TOO_MANY_ATTEMPTS') {
          setChallenge(null);
          setCode('');
        }
      } else {
        setError('Vérification impossible.');
      }
    } finally {
      setSending(false);
    }
  }

  const minutes = Math.floor(remaining / 60);
  const seconds = String(remaining % 60).padStart(2, '0');

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-ink p-12 text-white lg:flex">
        <Link to="/" className="text-xl font-black">
          <span className="text-brand">5</span>DEV
        </Link>
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-brand">Console 5DEV</p>
          <h1 className="mt-4 text-4xl font-black leading-tight">
            L’espace de travail
            <br />
            de l’agence.
          </h1>
          <p className="mt-4 max-w-sm text-sm text-white/60">
            Demandes, projets, facturation et réglages. Accès protégé par mot de passe et code à usage
            unique.
          </p>
        </div>
        <p className="flex items-center gap-2 text-xs text-white/35">
          <ShieldCheck className="size-3.5" aria-hidden /> Double authentification obligatoire
        </p>
      </div>

      <div className="flex flex-col">
        {/* logo + bande sombre sur mobile : l'identité reste visible sans le panneau desktop */}
        <header className="flex items-center justify-between border-b border-white/10 bg-ink px-5 py-4 text-white lg:hidden">
          <Link to="/" className="text-lg font-black">
            <span className="text-brand">5</span>DEV
          </Link>
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/50">Console</span>
        </header>

        <div className="flex flex-1 items-center justify-center p-6 sm:p-12">
        {!challenge ? (
          <form onSubmit={submitPassword} className="anim-rise w-full max-w-sm">
            <h2 className="text-2xl font-black">Connexion</h2>
            <p className="mt-2 text-sm text-ink/60">Étape 1 sur 2 — identifiants.</p>

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
              {sending ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Vérification…
                </>
              ) : (
                'Continuer'
              )}
            </button>

            <Link to="/" className="mt-6 block text-center text-xs text-muted hover:text-brand">
              Retour au site
            </Link>
          </form>
        ) : (
          <form onSubmit={submitCode} className="anim-rise w-full max-w-sm">
            <div className="flex items-center gap-2 text-brand">
              <KeyRound className="size-4" aria-hidden />
              <p className="text-[11px] uppercase tracking-wider">
                {challenge.enroll ? 'Première connexion' : 'Vérification'}
              </p>
            </div>
            <h2 className="mt-2 text-2xl font-black">
              {challenge.enroll ? 'Activez le code à 6 chiffres' : 'Entrez votre code'}
            </h2>
            <p className="mt-2 text-sm text-ink/60">
              {challenge.enroll
                ? 'Ajoutez ce compte dans votre application d’authentification, puis saisissez le code affiché.'
                : 'Étape 2 sur 2 — code de votre application d’authentification.'}
            </p>

            {challenge.enroll && challenge.secret && (
              <div className="mt-5 rounded-xl border border-line bg-wash p-4">
                {challenge.otpauth_url && <EnrollQr value={challenge.otpauth_url} />}
                <p className="mt-3 text-[11px] uppercase tracking-wider text-muted">Ou saisir la clé à la main</p>
                <p className="mt-1 break-all font-mono text-sm font-semibold">{challenge.secret}</p>
                {challenge.otpauth_url && (
                  <a
                    href={challenge.otpauth_url}
                    className="mt-2 inline-block text-[11px] font-medium text-brandDark underline underline-offset-2 hover:text-brand"
                    rel="noreferrer"
                  >
                    Ouvrir dans l’application d’authentification
                  </a>
                )}
              </div>
            )}

            <div className="mt-6">
              <label className="label" htmlFor="code">
                Code à 6 chiffres
              </label>
              <input
                id="code"
                ref={codeRef}
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9 ]{6,8}"
                maxLength={8}
                required
                className="field text-center font-mono text-2xl tracking-[0.4em]"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/[^\d\s]/g, ''))}
                placeholder="000000"
              />
              <p className="mt-2 text-[11px] text-muted">
                Valable {minutes}:{seconds}
              </p>
            </div>

            {error && (
              <p role="alert" className="mt-4 rounded-lg border border-brand/40 bg-brand/5 p-3 text-sm">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={sending || code.replace(/\s/g, '').length < 6}
              className="btn-primary mt-5 w-full disabled:opacity-50"
            >
              {sending ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Vérification…
                </>
              ) : (
                <>
                  <Check className="size-4" /> Entrer
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setChallenge(null);
                setCode('');
                setError(null);
              }}
              className="mt-4 flex w-full items-center justify-center gap-1.5 text-xs text-muted hover:text-brand"
            >
              <ArrowLeft className="size-3.5" /> Recommencer
            </button>
          </form>
        )}
        </div>
      </div>
    </div>
  );
}

/**
 * QR d'enrôlement TOTP, généré dans le navigateur à partir de l'URL otpauth.
 * Aucun service externe : le secret ne quitte jamais le poste.
 */
function EnrollQr({ value }: { value: string }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void import('qrcode')
      .then((QR) =>
        QR.toDataURL(value, {
          errorCorrectionLevel: 'M',
          margin: 1,
          width: 220,
          color: { dark: '#171717', light: '#FFFFFF' },
        }),
      )
      .then((url) => {
        if (alive) setSrc(url);
      })
      .catch(() => setSrc(null));
    return () => {
      alive = false;
    };
  }, [value]);

  return (
    <div className="flex flex-col items-center">
      <p className="text-[11px] uppercase tracking-wider text-muted">Scannez avec votre application</p>
      <div className="mt-2 grid size-[132px] place-items-center rounded-lg bg-white p-2 shadow-sm">
        {src ? (
          <img src={src} alt="QR code d’enrôlement de la double authentification" width={116} height={116} />
        ) : (
          <span className="size-4 animate-spin rounded-full border-2 border-line border-t-brand" aria-hidden />
        )}
      </div>
      <p className="mt-2 max-w-[22ch] text-center text-[10px] leading-snug text-muted">
        Google Authenticator, Authy, Microsoft Authenticator, 1Password…
      </p>
    </div>
  );
}
