import { useEffect, useRef, useState, type ReactNode } from 'react';
import { motion, useScroll, useSpring, useTransform } from 'motion/react';
import { motionTokens } from '../../lib/motion-tokens';

/**
 * Parallaxe verticale liée au défilement. `speed` positif = la couche monte
 * pendant que la page descend (profondeur), négatif = elle descend plus vite.
 */
export function Parallax({
  children,
  speed = 60,
  className = '',
  scale = false,
}: {
  children: ReactNode;
  speed?: number;
  className?: string;
  scale?: boolean;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const raw = useTransform(scrollYProgress, [0, 1], [speed, -speed]);
  const y = useSpring(raw, { stiffness: 120, damping: 26, mass: 0.4 });
  const s = useTransform(scrollYProgress, [0, 0.5, 1], scale ? [1.14, 1.06, 1.14] : [1, 1, 1]);

  return (
    <div ref={ref} className={`parallax ${className}`} data-parallax="on">
      <motion.div className="parallax-layer" style={{ y, scale: s }}>
        {children}
      </motion.div>
    </div>
  );
}

/**
 * Section épinglée : le bloc reste collé pendant que les étapes défilent,
 * l'étape active est mise en avant selon la progression.
 */
export function StickyStory({
  steps,
  title,
  className = '',
}: {
  steps: { title: string; body: string }[];
  title: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });
  const active = useActiveStep(scrollYProgress, steps.length);

  return (
    <div ref={ref} className={`sticky-story ${className}`} style={{ height: `${steps.length * 90}vh` }}>
      <div className="sticky-story-inner">
        <div className="sticky-story-head">
          <p className="eyebrow">La méthode</p>
          <h2 className="display-2">{title}</h2>
          <div className="sticky-story-rail" aria-hidden>
            {steps.map((s, i) => (
              <motion.span
                key={s.title}
                className="sticky-story-dot"
                animate={{
                  backgroundColor: i === active ? '#f47721' : 'rgba(23,23,23,0.18)',
                  scale: i === active ? 1.35 : 1,
                }}
                transition={{ duration: motionTokens.duration.fast, ease: motionTokens.easing.smooth }}
              />
            ))}
          </div>
        </div>
        <ol className="sticky-story-list">
          {steps.map((s, i) => (
            <li key={s.title} className={`sticky-story-item ${i === active ? 'is-active' : ''}`}>
              <span className="sticky-story-num tnum">{String(i + 1).padStart(2, '0')}</span>
              <div>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function useActiveStep(progress: ReturnType<typeof useScroll>['scrollYProgress'], count: number) {
  const [active, setActive] = useState(0);
  useEffect(() => {
    const unsub = progress.on('change', (v) => {
      const idx = Math.min(count - 1, Math.max(0, Math.floor(v * count)));
      setActive(idx);
    });
    return unsub;
  }, [progress, count]);
  return active;
}
