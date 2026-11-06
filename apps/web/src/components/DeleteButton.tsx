import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { apiDelete } from '../lib/api';
import { ConfirmDialog } from './ConfirmDialog';
import { useToast } from './Toaster';

/**
 * Bouton de suppression complet : icône, confirmation, traitement, toast.
 * Un seul composant pour toutes les listes — évite d'oublier la confirmation
 * quelque part (c'est exactement ce qui s'était produit).
 */
export function DeleteButton({
  label,
  detail,
  path,
  invalidate = [],
  title = 'Supprimer cet élément ?',
  confirmLabel = 'Supprimer',
  onDone,
}: {
  /** nom lisible de l'élément, affiché dans la confirmation */
  label: string;
  /** phrase de conséquence, optionnelle */
  detail?: string;
  /** chemin API à appeler en DELETE */
  path: string;
  /** clés react-query à rafraîchir après succès */
  invalidate?: string[][];
  title?: string;
  confirmLabel?: string;
  onDone?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const toast = useToast();

  return (
    <>
      <button
        type="button"
        aria-label={`Supprimer ${label}`}
        title={`Supprimer ${label}`}
        className="rounded-md p-1.5 text-muted transition hover:bg-brand/10 hover:text-brand"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="size-4" />
      </button>

      <ConfirmDialog
        open={open}
        title={title}
        confirmLabel={confirmLabel}
        description={
          <>
            <strong>{label}</strong>
            {detail ? <> — {detail}</> : null} Cette action est définitive.
          </>
        }
        onCancel={() => setOpen(false)}
        onConfirm={async () => {
          await apiDelete(path);
          for (const key of invalidate) await qc.invalidateQueries({ queryKey: key });
          toast.push('success', `${label} supprimé.`);
          setOpen(false);
          onDone?.();
        }}
      />
    </>
  );
}
