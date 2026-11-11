import { useCallback, useEffect, useMemo, useState } from 'react';
import { Copy, Check, RefreshCw, ShieldCheck } from 'lucide-react';
import { PressableButton } from './anim-ui';

/**
 * Générateur de mots de passe — 100 % local.
 *
 * Le tirage utilise `crypto.getRandomValues` avec rejet des valeurs hors plage
 * (pas de biais modulo), jamais `Math.random` qui est prédictible. Aucun appel
 * réseau : le mot de passe n'existe que dans le navigateur jusqu'à l'enregistrement.
 */

const SETS = {
  lower: 'abcdefghijkmnopqrstuvwxyz',
  upper: 'ABCDEFGHJKLMNPQRSTUVWXYZ',
  digits: '23456789',
  symbols: '!@#$%&*+-=?',
} as const;

type Options = {
  length: number;
  upper: boolean;
  digits: boolean;
  symbols: boolean;
  avoidAmbiguous: boolean;
};

const strip = (s: string, ambiguous: boolean) => (ambiguous ? s.replace(/[Il1O0o]/g, '') : s);

/** Entier uniforme dans [0, max) sans biais modulo. */
function randomInt(max: number): number {
  if (max <= 0) return 0;
  const limit = Math.floor(0xffffffff / max) * max;
  const buf = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buf);
    const v = buf[0] ?? 0;
    if (v < limit) return v % max;
  }
}

function generate(o: Options): string {
  const sets: string[] = [strip(SETS.lower, o.avoidAmbiguous)];
  if (o.upper) sets.push(strip(SETS.upper, o.avoidAmbiguous));
  if (o.digits) sets.push(strip(SETS.digits, o.avoidAmbiguous));
  if (o.symbols) sets.push(strip(SETS.symbols, o.avoidAmbiguous));

  const pool = sets.join('');
  const pick = (alphabet: string) => alphabet[randomInt(alphabet.length)] ?? '';

  const chars: string[] = sets.map(pick);
  while (chars.length < o.length) chars.push(pick(pool));

  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    const a = chars[i];
    const b = chars[j];
    if (a !== undefined && b !== undefined) {
      chars[i] = b;
      chars[j] = a;
    }
  }
  return chars.join('');
}

/** Entropie approximative : longueur × log2(taille de l'alphabet). */
function entropyBits(o: Options, sample: string): number {
  const distinct = new Set(sample).size;
  const poolSize = Math.max(distinct, 1);
  return Math.round(o.length * Math.log2(poolSize));
}

function strength(bits: number): { label: string; tone: string; ratio: number } {
  if (bits >= 110) return { label: 'Très solide', tone: 'var(--emerald, #10b981)', ratio: 1 };
  if (bits >= 80) return { label: 'Solide', tone: 'var(--brand)', ratio: 0.75 };
  if (bits >= 60) return { label: 'Moyen', tone: '#d97706', ratio: 0.5 };
  return { label: 'Faible', tone: '#dc2626', ratio: 0.25 };
}

export function PasswordGenerator({
  onUse,
  compact = false,
}: {
  onUse?: (password: string) => void;
  compact?: boolean;
}) {
  const [options, setOptions] = useState<Options>({
    length: 20,
    upper: true,
    digits: true,
    symbols: true,
    avoidAmbiguous: true,
  });
  const [value, setValue] = useState('');
  const [copied, setCopied] = useState(false);

  const regenerate = useCallback(() => {
    setValue(generate(options));
    setCopied(false);
  }, [options]);

  useEffect(() => {
    regenerate();
  }, [regenerate]);

  const bits = useMemo(() => (value ? entropyBits(options, value) : 0), [options, value]);
  const power = strength(bits);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className={compact ? '' : 'rounded-xl border border-line bg-wash p-4'}>
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-medium">
          <ShieldCheck className="size-3.5 text-brand" aria-hidden />
          Générateur
        </p>
        <span className="text-[10px] uppercase tracking-wider text-muted">{bits} bits</span>
      </div>

      <div className="mt-2 flex items-center gap-1.5">
        <output
          className="min-w-0 flex-1 truncate rounded-lg border border-line bg-paper px-3 py-2 font-mono text-sm"
          aria-live="polite"
        >
          {value}
        </output>
        <PressableButton className="btn-ghost !px-2 !py-2" onClick={regenerate} title="Régénérer" ariaLabel="Régénérer">
          <RefreshCw className="size-3.5" />
        </PressableButton>
        <PressableButton
          className="btn-ghost !px-2 !py-2"
          onClick={() => void copy()}
          title="Copier"
          ariaLabel="Copier le mot de passe"
        >
          {copied ? <Check className="size-3.5 text-emerald" /> : <Copy className="size-3.5" />}
        </PressableButton>
        {onUse && (
          <PressableButton className="btn-primary !px-3 !py-2 text-xs" onClick={() => onUse(value)}>
            Utiliser
          </PressableButton>
        )}
      </div>

      <div className="anim-track mt-2" style={{ height: 5 }} role="presentation">
        <div
          className="anim-fill"
          style={{ width: `${power.ratio * 100}%`, background: power.tone, transform: 'none' }}
        />
      </div>
      <p className="mt-1 text-[11px]" style={{ color: power.tone }}>
        {power.label}
      </p>

      {!compact && (
        <>
          <label className="mt-3 block text-xs">
            <span className="flex items-center justify-between text-muted">
              <span>Longueur</span>
              <span className="font-mono tabular-nums text-ink">{options.length}</span>
            </span>
            <input
              type="range"
              min={12}
              max={48}
              value={options.length}
              onChange={(e) => setOptions({ ...options, length: Number(e.target.value) })}
              className="mt-1 w-full accent-[var(--brand)]"
              aria-label="Longueur du mot de passe"
            />
          </label>

          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
            {(
              [
                ['upper', 'Majuscules'],
                ['digits', 'Chiffres'],
                ['symbols', 'Symboles'],
                ['avoidAmbiguous', 'Éviter I, l, 1, O, 0'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex cursor-pointer items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={options[key]}
                  onChange={(e) => setOptions({ ...options, [key]: e.target.checked })}
                  className="accent-[var(--brand)]"
                />
                <span className="text-muted">{label}</span>
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
