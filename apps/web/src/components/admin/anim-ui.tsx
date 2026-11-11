import { useId, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Search, X } from 'lucide-react';
import { motionTokens, springs, stagger } from '../../lib/motion-tokens';
import { useSafeMotion, useMounted } from '../../lib/use-safe-motion';

/**
 * Primitives d'animation de la console — doctrine ECC `motion-foundations`
 * + `motion-patterns`.
 *
 * Contraintes tenues ici :
 *   - aucune durée ni courbe écrite en dur : tout vient de `motion-tokens` ;
 *   - seuls `transform` et `opacity` sont animés (jamais width/height/margin) ;
 *   - chaque apparition conditionnelle a son `exit` et une `key` stable ;
 *   - `prefers-reduced-motion` neutralise les translations (fondu court seul).
 */

/* ------------------------------------------------------------------ barres */

/** Barre de progression : pousse en `scaleX`, donc sans recalcul de mise en page. */
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
  const ratio = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  const mounted = useMounted();

  return (
    <div
      className="anim-track"
      style={{ height }}
      role="progressbar"
      aria-valuenow={Math.round(ratio * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <motion.div
        className="anim-fill"
        style={{
          background: tone === 'brand' ? 'var(--brand)' : 'color-mix(in srgb, var(--ink) 55%, transparent)',
        }}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: mounted ? ratio : 0 }}
        transition={{ ...springs.gentle, delay }}
      />
    </div>
  );
}

/* ------------------------------------------------------- entrées en cascade */

const listVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: stagger.normal, delayChildren: stagger.tight } },
  exit: { transition: { staggerChildren: 0.03, staggerDirection: -1 } },
};

/**
 * Liste animée : les entrées arrivent en cascade, les suppressions sortent
 * en fondu court avant de disparaître (`AnimatePresence` + `mode="popLayout"`).
 * À utiliser avec `StaggerItem` comme enfant direct.
 */
export function StaggerList({
  as = 'ul',
  className = '',
  children,
}: {
  as?: 'ul' | 'div';
  className?: string;
  children: ReactNode;
}) {
  const Comp = as === 'ul' ? motion.ul : motion.div;
  return (
    <Comp variants={listVariants} initial="hidden" animate="visible" className={className}>
      <AnimatePresence mode="popLayout" initial={false}>
        {children}
      </AnimatePresence>
    </Comp>
  );
}

/** Élément de `StaggerList`. S'anime seul (fonctionne aussi hors conteneur). */
export function StaggerItem({
  id,
  as = 'li',
  index = 0,
  step = 45,
  className = '',
  children,
}: {
  id: string;
  as?: 'li' | 'div' | 'tr';
  index?: number;
  step?: number;
  className?: string;
  children: ReactNode;
}) {
  const safe = useSafeMotion(motionTokens.distance.sm);
  const Comp = as === 'li' ? motion.li : as === 'tr' ? motion.tr : motion.div;

  return (
    <Comp
      key={id}
      initial={safe.initial}
      animate={safe.animate}
      exit={safe.exit}
      transition={{ ...springs.gentle, delay: (index * step) / 1000 }}
      className={className}
    >
      {children}
    </Comp>
  );
}

/** Alias historique : `Stagger` = `StaggerItem` sans identifiant explicite. */
export function Stagger({
  index = 0,
  step = 40,
  as = 'div',
  className = '',
  children,
}: {
  index?: number;
  step?: number;
  as?: 'div' | 'li' | 'tr';
  className?: string;
  children: ReactNode;
}) {
  const safe = useSafeMotion(motionTokens.distance.sm);
  const Comp = as === 'li' ? motion.li : as === 'tr' ? motion.tr : motion.div;

  return (
    <Comp
      initial={safe.initial}
      animate={safe.animate}
      exit={safe.exit}
      transition={{ ...springs.gentle, delay: (index * step) / 1000 }}
      className={className}
    >
      {children}
    </Comp>
  );
}

/**
 * Entrée isolée (hors liste) : une carte, un encart. Même contrat que
 * `StaggerItem` mais sans conteneur de cascade — le délai est explicite.
 */
export function FadeIn({
  index = 0,
  step = 70,
  as = 'div',
  className = '',
  children,
}: {
  index?: number;
  step?: number;
  as?: 'div' | 'li' | 'section';
  className?: string;
  children: ReactNode;
}) {
  const safe = useSafeMotion(motionTokens.distance.md);
  const Comp = as === 'li' ? motion.li : as === 'section' ? motion.section : motion.div;

  return (
    <Comp
      initial={safe.initial}
      animate={safe.animate}
      transition={{ ...springs.gentle, delay: (index * step) / 1000 }}
      className={className}
    >
      {children}
    </Comp>
  );
}

/* ------------------------------------------------------------- interactions */

/** Carte cliquable : soulèvement au survol, enfoncement à l'appui. */
export function PressableCard({ className = '', children }: { className?: string; children: ReactNode }) {
  return (
    <motion.div
      whileHover={{ y: -2, scale: 1.005 }}
      whileTap={{ scale: motionTokens.scale.subtle }}
      transition={springs.snappy}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/** Bouton avec retour tactile : à préférer aux boutons sans état d'appui. */
export function PressableButton({
  onClick,
  className = '',
  disabled,
  title,
  ariaLabel,
  children,
}: {
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
  title?: string;
  ariaLabel?: string;
  children: ReactNode;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
      whileHover={disabled ? undefined : { scale: 1.02 }}
      whileTap={disabled ? undefined : { scale: motionTokens.scale.press }}
      transition={springs.snappy}
      className={className}
    >
      {children}
    </motion.button>
  );
}

/* ---------------------------------------------------------------- recherche */

/** Champ de recherche de la console : icône, effacement animé, focus visible. */
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
      <AnimatePresence>
        {value && (
          <motion.button
            key="clear"
            type="button"
            className="search-clear"
            onClick={() => onChange('')}
            aria-label="Effacer la recherche"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            whileTap={{ scale: motionTokens.scale.press }}
            transition={{ duration: motionTokens.duration.fast }}
          >
            <X className="size-3" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
