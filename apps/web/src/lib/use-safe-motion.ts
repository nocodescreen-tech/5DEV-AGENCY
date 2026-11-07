import { useEffect, useState } from 'react';
import { motionConfig, motionTokens } from './motion-tokens';

/**
 * Variantes d'entrée/sortie sûres : si l'utilisateur demande moins de mouvement,
 * les translations et rotations sont neutralisées, seul un fondu court reste.
 */
export function useSafeMotion(distance: number = motionTokens.distance.md) {
  const [reduced, setReduced] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  if (reduced) {
    return {
      reduced,
      initial: { opacity: 0, y: 0, rotateX: 0, scale: 1 },
      animate: { opacity: 1, y: 0, rotateX: 0, scale: 1 },
      exit: { opacity: 0, y: 0, rotateX: 0, scale: 1 },
      duration: motionTokens.duration.fast,
    };
  }
  return {
    reduced,
    initial: { opacity: 0, y: distance, rotateX: 0, scale: 1 },
    animate: { opacity: 1, y: 0, rotateX: 0, scale: 1 },
    exit: { opacity: 0, y: -distance, rotateX: 0, scale: 1 },
    duration: motionTokens.duration.normal,
  };
}

/** true dès que le composant est monté (garde SSR/hydratation). */
export function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

/** Effets de pointeur autorisés ? (pas tactile, pas reduced-motion) */
export function usePointerEffects() {
  const [allowed, setAllowed] = useState(false);
  useEffect(() => {
    // Seuls le réglage système et le tactile coupent les effets de pointeur.
    // Un appareil modeste garde l'inclinaison (peu coûteuse) mais perd les couches lourdes.
    const compute = () => setAllowed(!motionConfig.prefersReduced() && !motionConfig.isTouch());
    compute();
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    mq.addEventListener('change', compute);
    return () => mq.removeEventListener('change', compute);
  }, []);
  return allowed;
}
