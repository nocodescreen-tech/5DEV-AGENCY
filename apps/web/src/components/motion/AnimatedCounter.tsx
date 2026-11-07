import { useEffect, useRef, useState } from 'react';
import { animate, useInView } from 'motion/react';
import { motionTokens } from '../../lib/motion-tokens';

/**
 * Compteur animé sur des données réelles : la valeur est fournie par l'appelant
 * (API), jamais inventée. `tabular-nums` évite le tremblement des chiffres.
 */
export function AnimatedCounter({
  value,
  suffix = '',
  duration = motionTokens.duration.crawl * 1.2,
  className = '',
}: {
  value: number;
  suffix?: string;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const inView = useInView(ref, { once: true, margin: '-10%' });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplay(value);
      return;
    }
    const controls = animate(0, value, {
      duration,
      ease: motionTokens.easing.smooth,
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return () => controls.stop();
  }, [inView, value, duration]);

  return (
    <span ref={ref} className={`tnum ${className}`} data-counter={value}>
      {display}
      {suffix}
    </span>
  );
}
