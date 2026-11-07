import { useRef, useState, type ReactNode } from 'react';
import { motion, useMotionValue, useSpring } from 'motion/react';
import { motionTokens, springs } from '../../lib/motion-tokens';
import { usePointerEffects } from '../../lib/use-safe-motion';

type Ripple = { id: number; x: number; y: number };

/**
 * Enveloppe magnétique : l'élément suit légèrement le pointeur (attraction),
 * revient au centre par ressort, et projette une ondulation au clic.
 * Désactivée au tactile et en prefers-reduced-motion.
 */
export function Magnetic({
  children,
  strength = 10,
  className = '',
  ripple = true,
}: {
  children: ReactNode;
  strength?: number;
  className?: string;
  ripple?: boolean;
}) {
  const allowed = usePointerEffects();
  const ref = useRef<HTMLDivElement | null>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 260, damping: 20 });
  const sy = useSpring(y, { stiffness: 260, damping: 20 });
  const [ripples, setRipples] = useState<Ripple[]>([]);

  function move(e: React.PointerEvent<HTMLDivElement>) {
    if (!allowed || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    x.set(((e.clientX - r.left) / r.width - 0.5) * strength * 2);
    y.set(((e.clientY - r.top) / r.height - 0.5) * strength * 2);
  }

  function leave() {
    x.set(0);
    y.set(0);
  }

  function click(e: React.PointerEvent<HTMLDivElement>) {
    if (!ripple || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const id = Date.now() + Math.random();
    setRipples((list) => [...list, { id, x: e.clientX - r.left, y: e.clientY - r.top }]);
    window.setTimeout(() => setRipples((list) => list.filter((it) => it.id !== id)), 620);
  }

  return (
    <motion.div
      ref={ref}
      className={`magnetic ${className}`}
      style={{ x: sx, y: sy }}
      onPointerMove={move}
      onPointerLeave={leave}
      onPointerDown={click}
      data-magnetic={allowed ? 'on' : 'off'}
    >
      {children}
      {ripples.map((r) => (
        <span key={r.id} className="magnetic-ripple" aria-hidden style={{ left: r.x, top: r.y }} />
      ))}
    </motion.div>
  );
}

/**
 * Bouton complet : magnétisme, enfoncement 3D, reflet qui balaie, flèche qui avance,
 * états chargement / succès. Conserve le rendu `.btn` existant.
 */
export function MagneticButton({
  children,
  loading = false,
  success = false,
  className = 'btn btn-primary',
  type = 'button',
  disabled,
  onClick,
  ...rest
}: {
  children: ReactNode;
  loading?: boolean;
  success?: boolean;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  'aria-label'?: string;
  title?: string;
  form?: string;
}) {
  return (
    <Magnetic className="inline-flex" strength={7}>
      <motion.button
        {...rest}
        type={type}
        disabled={disabled}
        onClick={onClick}
        className={`${className} btn-motion ${success ? 'is-success' : ''}`}
        whileHover={{ y: -2, scale: motionTokens.scale.pop }}
        whileTap={{ scale: motionTokens.scale.press }}
        transition={springs.snappy}
        aria-busy={loading}
      >
        <span className="btn-shine" aria-hidden />
        <span className={`btn-label ${loading ? 'is-loading' : ''}`}>{children}</span>
        {loading && <span className="btn-spinner" aria-hidden />}
      </motion.button>
    </Magnetic>
  );
}
