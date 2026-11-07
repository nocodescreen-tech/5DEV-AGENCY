import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { motionTokens, springs, stagger } from '../../lib/motion-tokens';

const dirs = {
  up: { y: motionTokens.distance.lg, x: 0 },
  down: { y: -motionTokens.distance.lg, x: 0 },
  left: { y: 0, x: -motionTokens.distance.xl },
  right: { y: 0, x: motionTokens.distance.xl },
  none: { y: 0, x: 0 },
} as const;

/** Révélation à l'entrée dans le viewport, une seule fois, sans laisser d'élément invisible. */
export function RevealOnScroll({
  children,
  delay = 0,
  from = 'up',
  blur = true,
  className = '',
  as = 'div',
}: {
  children: ReactNode;
  delay?: number;
  from?: keyof typeof dirs;
  blur?: boolean;
  className?: string;
  as?: 'div' | 'section' | 'article' | 'li' | 'header';
}) {
  const d = dirs[from];
  const Tag = motion[as];
  return (
    <Tag
      className={className}
      initial={{ opacity: 0, ...d, filter: blur ? 'blur(10px)' : 'none' }}
      whileInView={{ opacity: 1, y: 0, x: 0, filter: 'blur(0px)' }}
      viewport={{ once: true, margin: '-10% 0px -10% 0px' }}
      transition={{ duration: motionTokens.duration.slow, ease: motionTokens.easing.smooth, delay }}
    >
      {children}
    </Tag>
  );
}

const groupVariants = {
  hidden: {},
  show: { transition: { staggerChildren: stagger.normal, delayChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: motionTokens.distance.lg, filter: 'blur(8px)' },
  show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: springs.gentle },
};

/** Conteneur de cascade : les enfants directs `StaggerItem` entrent l'un après l'autre. */
export function StaggerGroup({ children, className = '', as = 'div' }: { children: ReactNode; className?: string; as?: 'div' | 'ul' | 'ol' }) {
  const Tag = motion[as];
  return (
    <Tag className={className} variants={groupVariants} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-8% 0px -8% 0px' }}>
      {children}
    </Tag>
  );
}

export function StaggerItem({ children, className = '', as = 'div' }: { children: ReactNode; className?: string; as?: 'div' | 'li' | 'article' }) {
  const Tag = motion[as];
  return (
    <Tag className={className} variants={itemVariants}>
      {children}
    </Tag>
  );
}
