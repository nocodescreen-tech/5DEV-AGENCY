/**
 * Jetons de mouvement 5DEV — source unique des durées, courbes et ressorts.
 * Aucune valeur numérique de durée/easing ne doit être écrite ailleurs.
 * (doctrine ECC motion-foundations)
 */

export const motionTokens = {
  duration: {
    instant: 0.08,
    fast: 0.18,
    normal: 0.35,
    slow: 0.6,
    crawl: 1.0,
  },
  easing: {
    smooth: [0.22, 1, 0.36, 1] as [number, number, number, number],
    sharp: [0.4, 0, 0.2, 1] as [number, number, number, number],
    bounce: [0.34, 1.56, 0.64, 1] as [number, number, number, number],
    linear: [0, 0, 1, 1] as [number, number, number, number],
  },
  distance: { xs: 4, sm: 8, md: 16, lg: 24, xl: 48, xxl: 96 },
  scale: { subtle: 0.98, press: 0.95, pop: 1.04 },
  /** inclinaison maximale des cartes 3D, en degrés */
  tilt: 14,
  /** perspective des cartes 3D, en pixels */
  perspective: 1100,
} as const;

export const springs = {
  snappy: { type: 'spring', stiffness: 300, damping: 30 },
  gentle: { type: 'spring', stiffness: 120, damping: 14 },
  bouncy: { type: 'spring', stiffness: 400, damping: 10 },
  instant: { type: 'spring', stiffness: 600, damping: 35 },
  release: { type: 'spring', stiffness: 200, damping: 20, restDelta: 0.001 },
} as const;

/** Délais de cascade : toujours dans la fourchette 0,05–0,10 s. */
export const stagger = { tight: 0.05, normal: 0.07, loose: 0.1 } as const;

export const motionConfig = {
  prefersReduced(): boolean {
    return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  },
  /** Appareil modeste : peu de cœurs, ou mémoire déclarée faible. */
  isLowEnd(): boolean {
    if (typeof navigator === 'undefined') return false;
    const cores = navigator.hardwareConcurrency ?? 8;
    const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
    return cores <= 4 || mem <= 4;
  },
  /** Le tactile coupe les effets de pointeur (tilt, magnétisme). */
  isTouch(): boolean {
    return typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches;
  },
  shouldAnimate({ essential = false } = {}): boolean {
    if (this.prefersReduced()) return false;
    if (!essential && this.isLowEnd()) return false;
    return true;
  },
} as const;
