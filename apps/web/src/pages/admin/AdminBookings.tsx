import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPatch } from '../../lib/api';
import type { Booking } from '../../lib/types';
import { frDate } from '../../lib/format';

const SLOT_LABEL: Record<Booking['slot'], string> = {
  morning: 'Matin',
  afternoon: 'Après-midi',
  evening: 'Soirée',
};

const STATUS: { value: Booking['status']; label: string }[] = [
  { value: 'pending', label: 'À confirmer' },
  { value: 'confirmed', label: 'Confirmée' },
  { value: 'done', label: 'Réalisée' },
  { value: 'cancelled', label: 'Annulée' },
];

export default function AdminBookings() {
  const qc = useQueryClient();
  const { data, isPending } = useQuery({
    queryKey: ['bookings'],
    queryFn: () => apiGet<Booking[]>('/api/v1/admin/bookings'),
  });

  const patch = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Booking['status'] }) =>
      apiPatch(`/api/v1/admin/bookings/${id}`, { status }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['bookings'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  return (
    <div>
      <h1 className="text-2xl font-black">Réservations</h1>
      <p className="mt-1 text-sm text-muted">Séances photo demandées depuis le site.</p>

      {isPending && <p className="mt-8 text-sm text-muted">Chargement…</p>}

      {data && data.length === 0 && (
        <p className="mt-8 rounded-xl border border-dashed border-line p-8 text-center text-sm text-muted">
          Aucune réservation pour l’instant.
        </p>
      )}

      <div className="mt-6 overflow-x-auto">
        {data && data.length > 0 && (
          <table className="w-full min-w-[720px] border-separate border-spacing-y-2 text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted">
                <th className="px-3 py-2">Client</th>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Créneau</th>
                <th className="px-3 py-2">Prestation</th>
                <th className="px-3 py-2">Statut</th>
              </tr>
            </thead>
            <tbody>
              {data.map((b) => (
                <tr key={b.id} className="bg-white">
                  <td className="rounded-l-lg px-3 py-3">
                    <p className="font-medium">{b.full_name}</p>
                    <p className="text-xs text-muted">{b.email}</p>
                    {b.phone && <p className="text-xs text-muted">{b.phone}</p>}
                  </td>
                  <td className="px-3 py-3">{frDate(b.shoot_date)}</td>
                  <td className="px-3 py-3">{SLOT_LABEL[b.slot]}</td>
                  <td className="px-3 py-3 text-xs">
                    {b.service_title ?? '—'}
                    {b.location && <span className="block text-muted">{b.location}</span>}
                  </td>
                  <td className="rounded-r-lg px-3 py-3">
                    <select
                      className="field !w-auto !py-2 text-xs"
                      value={b.status}
                      onChange={(e) => patch.mutate({ id: b.id, status: e.target.value as Booking['status'] })}
                      aria-label={`Statut de la réservation de ${b.full_name}`}
                    >
                      {STATUS.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
