import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

type Kind = 'success' | 'error';
type Toast = { id: number; kind: Kind; message: string; leaving?: boolean };

const ToastContext = createContext<{ push: (kind: Kind, message: string) => void } | null>(null);

/** Notifications animées — aucune dépendance externe, sortie en fondu. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((kind: Kind, message: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, message }]);
    window.setTimeout(() => {
      setToasts((t) => t.map((x) => (x.id === id ? { ...x, leaving: true } : x)));
      window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 320);
    }, 4200);
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-6">
        {toasts.map((t) => (
          <div
            key={t.id}
            data-leaving={t.leaving ? 'true' : 'false'}
            role="status"
            aria-live="polite"
            className="toast pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-xl border border-line bg-paper px-4 py-3 shadow-lg"
          >
            {t.kind === 'success' ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
            ) : (
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
            )}
            <p className="text-sm leading-snug">{t.message}</p>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast doit être utilisé dans ToastProvider');
  return ctx;
}
