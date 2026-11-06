import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
  delay?: number;
  className?: string;
  as?: 'div' | 'section' | 'li';
};

/**
 * Apparition à l'affichage. Volontairement basée sur `animate` (et non
 * `whileInView`) : le contenu ne dépend jamais d'un observateur de défilement,
 * donc il est toujours visible — y compris en capture pleine page ou si
 * l'observateur ne se déclenche pas.
 */
export default function Reveal({ children, delay = 0, className, as = 'div' }: Props) {
  const reduce = useReducedMotion();
  const Component = motion[as];

  return (
    <Component
      className={className}
      initial={reduce ? false : { opacity: 0, y: 18 }}
      animate={reduce ? undefined : { opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </Component>
  );
}
