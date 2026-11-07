import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Info, Plus } from 'lucide-react';
import { TiltCard3D } from './motion/TiltCard3D';

/* ------------------------------------------------------------- révélation */

export function Reveal({
  children,
  delay = 0,
  className = '',
  as: Tag = 'div',
  style,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  as?: 'div' | 'section' | 'li' | 'article' | 'header';
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          // visible, ou déjà dépassé vers le haut : dans les deux cas le contenu doit être là
          const passed = e.boundingClientRect.bottom < 0;
          if (e.isIntersecting || passed) {
            setSeen(true);
            io.disconnect();
          }
        }
      },
      // marge large : tout ce qui est à moins d'un écran et demi au-dessus ou en dessous
      // est déjà révélé. Un saut d'ancre ou un glissement rapide de la barre de défilement
      // ne laisse donc jamais de section vide.
      { rootMargin: '150% 0px 150% 0px', threshold: 0 },
    );
    io.observe(el);
    // filet de sécurité : jamais de contenu bloqué invisible
    const t = window.setTimeout(() => setSeen(true), 700);
    return () => {
      io.disconnect();
      window.clearTimeout(t);
    };
  }, []);

  return (
    <Tag
      ref={ref as never}
      className={`reveal ${seen ? 'is-in' : ''} ${className}`}
      style={{ ['--reveal-delay' as string]: `${delay}ms`, ...style }}
    >
      {children}
    </Tag>
  );
}

/* ------------------------------------------------------------------ image */

/** Image locale responsive : shimmer au chargement, dimensions fixes (pas de CLS). */
export function MediaImage({
  slug,
  alt,
  width,
  height,
  sizes = '100vw',
  priority = false,
  className = '',
}: {
  slug: string;
  alt: string;
  width: number;
  height: number;
  sizes?: string;
  priority?: boolean;
  className?: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<HTMLImageElement | null>(null);

  // une image déjà en cache doit être marquée chargée tout de suite
  useEffect(() => {
    const img = ref.current;
    if (img?.complete && img.naturalWidth > 0) setLoaded(true);
  }, []);

  return (
    <div className={`media ${loaded ? 'is-loaded' : ''} ${className}`} data-priority={priority ? 'true' : undefined}>
      <img
        ref={ref}
        src={`/photos/${slug}-1600.webp`}
        srcSet={`/photos/${slug}-900.webp 900w, /photos/${slug}-1600.webp 1600w`}
        sizes={sizes}
        width={width}
        height={height}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        {...{ fetchpriority: priority ? 'high' : 'auto' }}
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(true)}
      />
    </div>
  );
}

/* ------------------------------------------------------- carte inclinable */

/**
 * Carte 3D : perspective réelle, reflet et projecteur qui suivent le pointeur,
 * couches enfants flottantes, élévation au survol.
 * Implémentation dans `components/motion/TiltCard3D.tsx` (couche motion 5DEV).
 */
export function TiltCard({
  children,
  className = '',
  max = 12,
  glare = true,
}: {
  children: ReactNode;
  className?: string;
  max?: number;
  glare?: boolean;
}) {
  return (
    <TiltCard3D className={className} max={max} glare={glare}>
      {children}
    </TiltCard3D>
  );
}

/* --------------------------------------------------------- états & squelettes */

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-ink/10 ${className}`} aria-hidden />;
}

export function EmptyState({
  title,
  description,
  action,
  icon: Icon = Info,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: typeof Info;
}) {
  return (
    <div className="empty-state">
      <Icon className="mx-auto size-6 text-brand" aria-hidden />
      <p className="mt-3 font-semibold">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-xl border border-brand/40 bg-brand/5 p-4">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
        <div>
          <p className="text-sm font-medium">Une erreur est survenue</p>
          <p className="mt-0.5 text-sm text-muted">{message}</p>
          {onRetry && (
            <button type="button" onClick={onRetry} className="mt-2 text-sm font-medium text-brand hover:underline">
              Réessayer
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- tooltip */

export function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="group relative inline-flex">
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute -top-2 left-1/2 z-20 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md bg-ink px-2 py-1 text-[11px] text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {label}
      </span>
    </span>
  );
}

/* ----------------------------------------------------------------- accordéon */

export function Accordion({ items }: { items: { q: string; a: string }[] }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div>
      {items.map((item, i) => (
        <div key={item.q} className="acc-item" data-open={open === i}>
          <button
            type="button"
            className="acc-trigger"
            aria-expanded={open === i}
            onClick={() => setOpen(open === i ? null : i)}
          >
            <span>{item.q}</span>
            <Plus className="acc-icon size-4 text-brand" aria-hidden />
          </button>
          <div className="acc-panel">
            <div>
              <p className="text-sm leading-relaxed text-muted">{item.a}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------- modale */

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  // rendu hors de l'arbre : `position: fixed` reste ancré à la fenêtre même si un
  // parent a un transform ou transform-style: preserve-3d (cas des cartes 3D).
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Fermer" className="modal-backdrop absolute inset-0 bg-ink/60 backdrop-blur-sm" onClick={onClose} />
      <div className="modal-panel relative w-full max-w-lg rounded-t-2xl bg-paper p-6 shadow-2xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-4">
          <h2 className="display-3">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-muted hover:text-ink" aria-label="Fermer">
            <Plus className="size-5 rotate-45" aria-hidden />
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
