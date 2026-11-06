import { useEffect, useState, type ReactNode } from 'react';
import { AlertTriangle, Check, Loader2, X } from 'lucide-react';

type State = 'idle' | 'working' | 'done' | 'error';

/**
 * Confirmation d'action destructive : jamais de suppression directe.
 * Trois états visibles — traitement, succès, erreur — pour que l'utilisateur
 * sache ce qui se passe au lieu de deviner.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Supprimer',
  cancelLabel = 'Annuler',
  tone = 'danger',
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
  onCancel: () => void;
  onConfirm: () => Promise<void> | void;
}) {
  const [state, setState] = useState<State>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setState('idle');
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && state !== 'working') onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onCancel, state]);

  if (!open) return null;

  async function run() {
    setState('working');
    setError(null);
    try {
      await onConfirm();
      setState('done');
      window.setTimeout(() => onCancel(), 650);
    } catch (err) {
      setState('error');
      setError(err instanceof Error ? err.message : 'Action impossible.');
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={title}>
      <button
        type="button"
        aria-label="Fermer"
        className="modal-backdrop absolute inset-0 bg-ink/60 backdrop-blur-sm"
        onClick={() => state !== 'working' && onCancel()}
      />
      <div className="modal-panel relative w-full max-w-md rounded-t-2xl bg-paper p-6 shadow-2xl sm:rounded-2xl">
        <div className="flex items-start gap-3">
          <span
            className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full ${
              state === 'done' ? 'bg-emerald-100 text-emerald-700' : tone === 'danger' ? 'bg-brand/12 text-brand' : 'bg-ink/8 text-ink'
            }`}
            aria-hidden
          >
            {state === 'done' ? <Check className="size-4" /> : <AlertTriangle className="size-4" />}
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold">{state === 'done' ? 'Terminé' : title}</h2>
            <div className="mt-1 text-sm text-muted">
              {state === 'done' ? 'L’opération a été effectuée.' : description}
            </div>
          </div>
          {state !== 'working' && (
            <button type="button" onClick={onCancel} className="ml-auto rounded p-1 text-muted hover:text-ink" aria-label="Fermer">
              <X className="size-4" />
            </button>
          )}
        </div>

        {state === 'error' && (
          <p className="mt-3 rounded-lg border border-brand/40 bg-brand/5 p-2.5 text-sm">{error}</p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            className="btn-ghost !py-2.5"
            onClick={onCancel}
            disabled={state === 'working' || state === 'done'}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={tone === 'danger' ? 'btn-primary !py-2.5' : 'btn-primary !py-2.5'}
            onClick={() => void run()}
            disabled={state === 'working' || state === 'done'}
          >
            {state === 'working' ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Traitement…
              </>
            ) : state === 'done' ? (
              <>
                <Check className="size-4" /> Fait
              </>
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
