import { useId, type ReactNode } from 'react';
import { Search, X } from 'lucide-react';

/**
 * Primitives d'animation pour la console admin.
 *
 * Trois briques seulement, réutilisées partout — une barre qui pousse, une entrée
 * en cascade, un champ de recherche. Aucune n'invente de donnée : la valeur vient
 * toujours de l'appelant (API). Tout est neutralisé en `prefers-reduced-motion`.
 */

/** Barre de progression animée (pousse de gauche à droite au montage). */
export function AnimatedBar({
  value,
  max = 100,
  tone = 'brand',
  height = 6,
  delay = 0,
  label,
}: {
  value: number;
  max?: number;
  tone?: 'brand' | 'ink';
  height?: number;
  delay?: number;
  label?: string;
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div
      className="anim-track"
      style={{ height }}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div
        className="anim-fill"
        style={{
          width: `${pct}%`,
          background: tone === 'brand' ? 'var(--brand)' : 'color-mix(in srgb, var(--ink) 55%, transparent)',
          animationDelay: `${delay}ms`,
        }}
      />
    </div>
  );
}

/** Enveloppe une entrée de liste : elle apparaît en cascade, jamais toutes d'un coup. */
export function Stagger({
  index = 0,
  step = 40,
  as: Tag = 'div',
  className = '',
  children,
}: {
  index?: number;
  step?: number;
  as?: 'div' | 'li' | 'tr';
  className?: string;
  children: ReactNode;
}) {
  return (
    <Tag className={`stagger-item ${className}`} style={{ animationDelay: `${index * step}ms` }}>
      {children}
    </Tag>
  );
}

/** Champ de recherche de la console : icône, effacement, focus animé. */
export function SearchInput({
  value,
  onChange,
  placeholder = 'Rechercher…',
  className = '',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={`search-field ${className}`}>
      <Search className="search-icon size-3.5" aria-hidden />
      <input
        id={id}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="search-input"
      />
      {value && (
        <button type="button" className="search-clear" onClick={() => onChange('')} aria-label="Effacer la recherche">
          <X className="size-3" />
        </button>
      )}
    </div>
  );
}
