import { Link, NavLink, Navigate, Outlet, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, FolderKanban, Inbox, LayoutDashboard, LogOut, Settings, Wrench } from 'lucide-react';
import { apiGet, apiPost } from '../../lib/api';

type Me = { user: { id: string; email: string; full_name: string; role: string } };

const LINKS = [
  { to: '/admin', label: 'Tableau de bord', icon: LayoutDashboard, end: true },
  { to: '/admin/demandes', label: 'Demandes', icon: Inbox },
  { to: '/admin/reservations', label: 'Réservations', icon: CalendarClock },
  { to: '/admin/services', label: 'Services', icon: Wrench },
  { to: '/admin/realisations', label: 'Réalisations', icon: FolderKanban },
  { to: '/admin/reglages', label: 'Réglages', icon: Settings },
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data, isPending, isError } = useQuery({
    queryKey: ['me'],
    queryFn: () => apiGet<Me>('/api/v1/auth/me'),
    retry: 0,
    staleTime: 60_000,
  });

  if (isPending) {
    return <div className="grid min-h-dvh place-items-center text-sm text-muted">Vérification de la session…</div>;
  }

  if (isError) return <Navigate to="/admin/connexion" replace />;

  async function logout() {
    await apiPost('/api/v1/auth/logout').catch(() => undefined);
    qc.clear();
    navigate('/admin/connexion', { replace: true });
  }

  return (
    <div className="min-h-dvh bg-wash">
      <header className="border-b border-line bg-white">
        <div className="container-x flex h-16 items-center justify-between">
          <Link to="/" className="text-lg font-black">
            5<span className="text-brand">DEV</span>
            <span className="ml-3 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
              console
            </span>
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <span className="hidden text-muted sm:block">{data?.user.email}</span>
            <button type="button" onClick={() => void logout()} className="inline-flex items-center gap-2 text-ink/70 hover:text-brand">
              <LogOut className="size-4" aria-hidden /> Quitter
            </button>
          </div>
        </div>
      </header>

      <div className="container-x grid gap-8 py-8 lg:grid-cols-[220px_1fr]">
        <nav aria-label="Navigation administration" className="lg:sticky lg:top-24 lg:self-start">
          <ul className="flex gap-1 overflow-x-auto lg:flex-col">
            {LINKS.map((l) => {
              const Icon = l.icon;
              return (
                <li key={l.to}>
                  <NavLink
                    to={l.to}
                    end={l.end}
                    className={({ isActive }) =>
                      `flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm transition ${
                        isActive ? 'bg-brand/10 font-medium text-brand' : 'text-ink/70 hover:bg-white'
                      }`
                    }
                  >
                    <Icon className="size-4" aria-hidden />
                    {l.label}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
