import { useEffect, useRef, useState, type ElementType, type ReactNode } from 'react';

/**
 * Découpe un titre court en mots animés individuellement (translate + rotateX).
 *
 * Contraintes tenues :
 *  - accessibilité : le texte complet reste lisible via aria-label, les fragments sont
 *    aria-hidden ; un lecteur d'écran lit une seule phrase correcte ;
 *  - pas de découpage par caractère (coût DOM) et aucun script payant ;
 *  - `prefers-reduced-motion` : aucun fragment animé, le texte s'affiche d'emblée ;
 *  - si JavaScript ne s'exécute pas, le texte est déjà dans le HTML (rendu serveur du
 *    composant, pas d'injection après coup).
 */
export function SplitHeadline({
  as: Tag = 'h1',
  text,
  className = '',
  delay = 0,
  step = 45,
  accent,
}: {
  as?: ElementType;
  text: string;
  className?: string;
  /** délai initial en ms */
  delay?: number;
  /** décalage entre deux mots en ms (20-60 recommandé) */
  step?: number;
  /** mot à colorer en orange */
  accent?: string;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [play, setPlay] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (typeof IntersectionObserver === 'undefined') {
      setPlay(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setPlay(true);
          io.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const words = text.split(' ');
  const accentIndex = accent ? words.findIndex((w) => w.replace(/[.,;:!?]/g, '') === accent) : -1;

  return (
    <Tag
      ref={ref as never}
      className={`split-headline ${play ? 'is-playing' : ''} ${className}`}
      aria-label={text}
    >
      {words.map((word, i) => (
        <span key={`${word}-${i}`} className="split-word" aria-hidden>
          <span
            className={`split-word-inner ${i === accentIndex ? 'text-brand' : ''}`}
            style={{ animationDelay: `${delay + i * step}ms` }}
          >
            {word}
          </span>
          {i < words.length - 1 ? '\u00A0' : ''}
        </span>
      ))}
    </Tag>
  );
}

/** Révélation en cascade d'une liste d'enfants, sans dépendance. */
export function Stagger({ children, step = 40, className = '' }: { children: ReactNode; step?: number; className?: string }) {
  return (
    <div className={`stagger-group ${className}`} style={{ ['--stagger-step' as string]: `${step}ms` }}>
      {children}
    </div>
  );
}
