import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useLocation } from 'react-router-dom';
import { motionTokens } from '../../lib/motion-tokens';

/**
 * Transition de route réelle : l'ancienne page sort (fondu + léger recul),
 * la nouvelle entre par un balayage `clip-path` avec flou qui se résorbe.
 * `mode="wait"` garantit qu'on ne voit jamais deux pages superposées.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        className="page-transition"
        data-page-transition="on"
        initial={{ opacity: 0, y: 14, clipPath: 'inset(0 0 14% 0)', filter: 'blur(8px)' }}
        animate={{ opacity: 1, y: 0, clipPath: 'inset(0 0 0% 0)', filter: 'blur(0px)' }}
        exit={{ opacity: 0, y: -10, filter: 'blur(5px)', transition: { duration: motionTokens.duration.fast, ease: motionTokens.easing.sharp } }}
        transition={{ duration: motionTokens.duration.slow, ease: motionTokens.easing.smooth }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
