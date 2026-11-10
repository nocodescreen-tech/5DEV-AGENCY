import { useRef, type ReactNode } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'motion/react';
import { motionTokens } from '../../lib/motion-tokens';
import { usePointerEffects } from '../../lib/use-safe-motion';

/**
 * Carte 3D réelle : la scène est en perspective, la carte pivote sur deux axes,
 * un reflet et un projecteur suivent le pointeur, et les couches enfants
 * (`.t3d-deep`, `.t3d-deeper`) flottent en translateZ pendant l'inclinaison.
 */
export function TiltCard3D({
  children,
  className = '',
  max = motionTokens.tilt,
  glare = true,
  spotlight = true,
  lift = 8,
}: {
  children: ReactNode;
  className?: string;
  max?: number;
  glare?: boolean;
  spotlight?: boolean;
  lift?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const allowed = usePointerEffects();

  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const hover = useMotionValue(0);

  const rotateY = useSpring(useTransform(px, [0, 1], [-max, max]), { stiffness: 220, damping: 22 });
  const rotateX = useSpring(useTransform(py, [0, 1], [max, -max]), { stiffness: 220, damping: 22 });
  const scale = useSpring(useTransform(hover, [0, 1], [1, 1.02]), { stiffness: 260, damping: 26 });
  const y = useSpring(useTransform(hover, [0, 1], [0, -lift]), { stiffness: 260, damping: 26 });

  function onMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!allowed) return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const nx = (e.clientX - r.left) / r.width;
    const ny = (e.clientY - r.top) / r.height;
    px.set(nx);
    py.set(ny);
    el.style.setProperty('--mx', `${nx * 100}%`);
    el.style.setProperty('--my', `${ny * 100}%`);
    el.style.setProperty('--t3d-glare', '1');
  }

  function onEnter() {
    hover.set(1);
  }

  function onLeave() {
    hover.set(0);
    px.set(0.5);
    py.set(0.5);
    const el = ref.current;
    if (el) el.style.setProperty('--t3d-glare', '0');
  }

  return (
    <div className="t3d-scene w-full" style={{ perspective: `${motionTokens.perspective}px` }}>
      <motion.div
        ref={ref}
        className={`t3d-card ${className}`}
        onPointerMove={onMove}
        onPointerEnter={onEnter}
        onPointerLeave={onLeave}
        onPointerCancel={onLeave}
        style={{ rotateX, rotateY, scale, y, transformStyle: 'preserve-3d' }}
        data-tilt={allowed ? 'on' : 'off'}
      >
        {children}
        {spotlight && <span className="t3d-spotlight" aria-hidden />}
        {glare && <span className="t3d-glare" aria-hidden />}
      </motion.div>
    </div>
  );
}

/** Enfant d'une carte 3D qui flotte en profondeur. */
export function TiltLayer({ children, depth = 28, className = '' }: { children: ReactNode; depth?: number; className?: string }) {
  return (
    <div className={`t3d-layer ${className}`} style={{ transform: `translateZ(${depth}px)` }}>
      {children}
    </div>
  );
}
