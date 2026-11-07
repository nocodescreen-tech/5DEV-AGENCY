import { useEffect, useRef, useState } from 'react';
import { motion, useScroll, useSpring } from 'motion/react';

/** Barre de progression de lecture : ressort sur le défilement + pourcentage lisible. */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 180, damping: 26, restDelta: 0.001 });
  const [pct, setPct] = useState(0);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const unsub = scrollYProgress.on('change', (v) => {
      if (raf.current) cancelAnimationFrame(raf.current);
      raf.current = requestAnimationFrame(() => setPct(Math.round(v * 100)));
    });
    return () => {
      unsub();
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [scrollYProgress]);

  return (
    <div className="scroll-progress" data-scroll-progress="on" aria-hidden>
      <motion.span className="scroll-progress-bar" style={{ scaleX }} />
      <span className="scroll-progress-pct tnum">{pct}</span>
    </div>
  );
}
