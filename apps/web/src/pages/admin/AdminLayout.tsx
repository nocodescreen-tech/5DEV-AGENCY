import { Link, NavLink, Navigate, Outlet, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import {
  Bell,
  Bot,
  CalendarClock,
  ChevronsLeft,
  ChevronsRight,
  FolderKanban,
  Inbox,
  LayoutDashboard,
  LogOut,
  Mails,
  Send,
  Settings,
  Sparkles,
  Wrench,
} from 'lucide-react';
import { apiGet, apiPost } from '../../lib/api';
import ThemeToggle from '../../components/ThemeToggle';

type Me = { user: { id: string; email: string; full_name: string; role: string } };

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; end?: boolean };
type NavGroup = { title: string; items: NavItem[] };

const GROUPS: NavGroup[] = [
  { title: 'Vue générale', items: [{ to: '/admin', label: 'Tableau de bord', icon: LayoutDashboard, end: true }] },
  {
    title: 'Commercial',
    items: [
      { to: '/admin/demandes', label: 'Demandes', icon: Inbox },
      { to: '/admin/reservations', label: 'Réservations', icon: CalendarClock },
    ],
  },
  {
    title: 'Services',
    items: [
      { to: '/admin/services', label: 'Services', icon: Wrench },
      { to: '/admin/realisations', label: 'Réalisations', icon: FolderKanban },
    ],
  },
  { title: 'Intelligence artificielle', items: [{ to: '/admin/ia', label: 'IA & modèles', icon: Bot }] },
  { title: 'Marketing', items: [{ to: '/admin/newsletter', label: 'Newsletter', icon: Send }] },
  { title: 'Communication', items: [{ to: '/admin/emails', label: 'Emails', icon: Mails }] },
  { title: 'Automatisation', items: [{ to: '/admin/automatisations', label: 'Workflows', icon: Sparkles }] },
  { title: 'Système', items: [{ to: '/admin/reglages', label: 'Réglages', icon: Settings }] },
];

const COLLAPSE_KEY = 'five.sidebar.collapsed';

export default function AdminLayout() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSE_KEY) === '1');
  const [notifOpen, setNotifOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
  }, [collapsed]);

  const { data, isPending, isError } = useQuery({
    queryKey: ['me'],
    queryFn: () => apiGet<Me>('/api/v1/auth/me'),
    retry: 0,
    staleTime: 60_000,
  });

  const { data: notifs } = useQuery({
    queryKey: ['notifications'],
    queryFn: () =>
      apiGet<{ notifications: { id: string; title: string; body: string | null; created_at: string }[]; unread: number }>(
        '/api/v1/admin/notifications',
      ),
    enabled: Boolean(data?.user),
    refetchInterval: 60_000,
  });

  if (isPending) {
    return (
      <div className="grid min-h-dvh place-items-center bg-wash">
        <div className="w-56 space-y-3">
          <div className="h-3 w-2/3 animate-pulse rounded bg-line" />
          <div className="h-3 w-full animate-pulse rounded bg-line" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-line" />
        </div>
      </div>
    );
  }

  if (isError) return <Navigate to="/admin/connexion" replace />;

  async function logout() {
    await apiPost('/api/v1/auth/logout').catch(() => undefined);
    qc.clear();
    navigate('/admin/connexion', { replace: true });
  }

  async function markRead() {
    await apiPost('/api/v1/admin/notifications/read').catch(() => undefined);
    void qc.invalidateQueries({ queryKey: ['notifications'] });
  }

  return (
    <div className="min-h-dvh bg-wash">
      <header className="sticky top-0 z-40 border-b border-line bg-paper">
        <div className="flex h-16 items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setCollapsed((v) => !v)}
              className="hidden size-9 place-items-center rounded-lg border border-line text-ink/60 hover:text-brand lg:grid"
              aria-label={collapsed ? 'Déplier la navigation' : 'Replier la navigation'}
              aria-expanded={!collapsed}
            >
              {collapsed ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
            </button>
            <Link to="/admin" className="text-lg font-black">
              5<span className="text-brand">DEV</span>
              <span className="ml-3 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">console</span>
            </Link>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle compact />
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setNotifOpen((v) => !v);
                  if (!notifOpen && (notifs?.unread ?? 0) > 0) void markRead();
                }}
                className="relative grid size-9 place-items-center rounded-lg border border-line text-ink/60 hover:text-brand"
                aria-label={`Notifications${notifs?.unread ? ` (${notifs.unread} non lues)` : ''}`}
                aria-expanded={notifOpen}
              >
                <Bell className="size-4" />
                {(notifs?.unread ?? 0) > 0 && (
                  <span className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-brand text-[10px] font-bold text-white">
                    {notifs?.unread}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 top-11 z-50 w-80 rounded-xl border border-line bg-paper p-2 shadow-lg">
                  {(notifs?.notifications ?? []).length === 0 ? (
                    <p className="p-3 text-xs text-muted">Aucune notification.</p>
                  ) : (
                    <ul className="max-h-72 overflow-auto">
                      {(notifs?.notifications ?? []).map((n) => (
                        <li key={n.id} className="rounded-lg p-3 hover:bg-wash">
                          <p className="text-sm font-medium">{n.title}</p>
                          {n.body && <p className="mt-1 text-xs text-muted">{n.body}</p>}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            <span className="hidden text-xs text-muted sm:block">{data?.user.email}</span>
            <button
              type="button"
              onClick={() => void logout()}
              className="inline-flex items-center gap-2 text-sm text-ink/70 hover:text-brand"
            >
              <LogOut className="size-4" aria-hidden />
              <span className="hidden sm:inline">Quitter</span>
            </button>
          </div>
        </div>
      </header>

      <div className="flex">
        <aside
          className={`hidden shrink-0 border-r border-line bg-paper lg:block ${
            collapsed ? 'w-[68px]' : 'w-[236px]'
          } transition-[width] duration-200`}
        >
          <nav aria-label="Navigation administration" className="sticky top-16 p-3">
            {GROUPS.map((group) => (
              <div key={group.title} className="mb-4">
                {!collapsed && (
                  <p className="mb-1.5 px-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
                    {group.title}
                  </p>
                )}
                <ul className="space-y-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <li key={item.to}>
                        <NavLink
                          to={item.to}
                          end={item.end}
                          title={collapsed ? item.label : undefined}
                          className={({ isActive }) =>
                            `flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition ${
                              isActive ? 'bg-brand/10 font-medium text-brand' : 'text-ink/70 hover:bg-wash'
                            }`
                          }
                        >
                          <Icon className="size-4 shrink-0" aria-hidden />
                          {!collapsed && <span className="truncate">{item.label}</span>}
                        </NavLink>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:py-8">
          {/* navigation mobile */}
          <nav className="mb-5 flex gap-1 overflow-x-auto lg:hidden" aria-label="Navigation mobile">
            {GROUPS.flatMap((g) => g.items).map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `whitespace-nowrap rounded-lg px-3 py-1.5 text-xs ${
                    isActive ? 'bg-brand text-white' : 'bg-paper text-ink/70'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <Outlet />
        </main>
      </div>
    </div>
  );
}
