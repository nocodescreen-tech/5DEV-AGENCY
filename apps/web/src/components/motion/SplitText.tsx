import { useEffect, useRef, useState, type ElementType } from 'react';
import { motion, useInView } from 'motion/react';
import { motionTokens, springs, stagger } from '../../lib/motion-tokens';


type Mode = 'words' | 'chars';

/**
 * Titre mis en scène : chaque mot (ou caractère) entre depuis le bas avec un flou
 * qui se résorbe. Déclenché à l'entrée dans le viewport, une seule fois.
 * Accessibilité : le texte complet reste dans `aria-label`, les fragments sont aria-hidden.
 */
export function SplitText({
  text,
  as: Tag = 'h2',
  className = '',
  mode = 'words',
  delay = 0,
  step = stagger.normal,
  accent,
  scramble = false,
}: {
  text: string;
  as?: ElementType;
  className?: string;
  mode?: Mode;
  delay?: number;
  step?: number;
  accent?: string;
  scramble?: boolean;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const inView = useInView(ref, { once: true, margin: '-12% 0px -12% 0px' });
  const [scrambled, setScrambled] = useState<string | null>(null);

  // Scramble : uniquement sur un titre court, jamais sur du texte long.
  useEffect(() => {
    if (!scramble || !inView) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const glyphs = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ#%&*';
    let frame = 0;
    let raf = 0;
    const total = Math.max(10, text.length * 2);
    const tick = () => {
      frame += 1;
      const revealed = Math.floor((frame / total) * text.length);
      setScrambled(
        text
          .split('')
          .map((c, i) => (c === ' ' ? ' ' : i < revealed ? c : glyphs[Math.floor(Math.random() * glyphs.length)]))
          .join(''),
      );
      if (frame < total) raf = requestAnimationFrame(tick);
      else setScrambled(null);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [scramble, inView, text]);

  const words = text.split(' ');
  const accentIndex = accent ? words.findIndex((w) => w.replace(/[.,;:!?]/g, '') === accent) : -1;

  const container = {
    hidden: {},
    show: { transition: { staggerChildren: step, delayChildren: delay } },
  };
  const item = {
    hidden: { opacity: 0, y: '0.6em', rotateX: -55, filter: 'blur(10px)' },
    show: {
      opacity: 1,
      y: '0em',
      rotateX: 0,
      filter: 'blur(0px)',
      transition: { ...springs.gentle, filter: { duration: motionTokens.duration.slow } },
    },
  };

  if (scrambled !== null) {
    return (
      <Tag ref={ref as never} className={`split-headline is-playing ${className}`} aria-label={text} data-scramble="on">
        <span aria-hidden>{scrambled}</span>
      </Tag>
    );
  }

  return (
    <Tag ref={ref as never} className={`split-headline ${className}`} aria-label={text}>
      <motion.span
        className="split-wrap"
        variants={container}
        initial="hidden"
        animate={inView ? 'show' : 'hidden'}
        aria-hidden
      >
        {words.map((word, wi) => (
          <span key={`${word}-${wi}`} className="split-word">
            {mode === 'chars' ? (
              <span className="split-chars">
                {[...word].map((ch, ci) => (
                  <motion.span
                    key={`${ch}-${ci}`}
                    className={`split-char ${wi === accentIndex ? 'text-brand' : ''}`}
                    variants={item}
                  >
                    {ch}
                  </motion.span>
                ))}
              </span>
            ) : (
              <motion.span
                className={`split-word-inner ${wi === accentIndex ? 'text-brand' : ''}`}
                variants={item}
              >
                {word}
              </motion.span>
            )}
            {wi < words.length - 1 ? '\u00A0' : ''}
          </span>
        ))}
      </motion.span>
    </Tag>
  );
}
