import { Link, NavLink, Navigate, Outlet, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import {
  Bell,
  Bot,
  CalendarClock,
  CalendarDays,
  CheckCheck,
  ChevronsLeft,
  ChevronsRight,
  FolderKanban,
  Inbox,
  LayoutDashboard,
  LayoutTemplate,
  ListChecks,
  LogOut,
  Mails,
  MessageSquare,
  Search,
  Send,
  Settings,
  Sparkles,
  Timer,
  Trash2,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import { apiDelete, apiGet, apiPost } from '../../lib/api';
import ThemeToggle from '../../components/ThemeToggle';
import { AssistantBubble } from '../../components/AssistantBubble';

import { PageTransition } from '../../components/motion/PageTransition';
import '../../admin.css';
type Me = {
  user: {
    id: string;
    email: string;
    full_name: string;
    display_name?: string | null;
    avatar_url?: string | null;
    job_title?: string | null;
    role: string;
  };
};

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; end?: boolean };
type NavGroup = { title: string; items: NavItem[] };

const GROUPS: NavGroup[] = [
  { title: 'Vue générale', items: [{ to: '/admin', label: 'Tableau de bord', icon: LayoutDashboard, end: true }] },
  {
    title: 'Workspace',
    items: [
      { to: '/admin/workspace', label: 'Vue générale', icon: LayoutDashboard },
      { to: '/admin/clients', label: 'Clients', icon: Users },
      { to: '/admin/projets', label: 'Projets', icon: FolderKanban },
      { to: '/admin/taches', label: 'Tâches', icon: ListChecks },
      { to: '/admin/planning', label: 'Planning', icon: CalendarDays },
      { to: '/admin/modeles', label: 'Modèles', icon: LayoutTemplate },
      { to: '/admin/temps', label: 'Temps', icon: Timer },
    ],
  },
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
  {
    title: 'Intelligence artificielle',
    items: [
      { to: '/admin/ia/chat', label: 'AI Chat', icon: MessageSquare },
      { to: '/admin/ia/modeles', label: 'Modèles & clé', icon: Bot },
      { to: '/admin/ia', label: 'Tâches et usage', icon: Sparkles, end: true },
    ],
  },
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
  const [navQuery, setNavQuery] = useState('');

  useEffect(() => {
    localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
  }, [collapsed]);

  const { data, isPending, isError } = useQuery({
    queryKey: ['me'],
    queryFn: () => apiGet<Me>('/api/v1/auth/me'),
    retry: 0,
    staleTime: 60_000,
  });

  const { data: counters } = useQuery({
    queryKey: ['counters'],
    queryFn: () =>
      apiGet<{ leads_new: number; bookings_pending: number; projects_active: number; tasks_open: number; tasks_late: number }>(
        '/api/v1/admin/counters',
      ),
    enabled: Boolean(data?.user),
    refetchInterval: 90_000,
  });

  /** badge associé à une entrée de navigation */
  const badgeFor = (to: string): number => {
    if (!counters) return 0;
    if (to === '/admin/demandes') return counters.leads_new;
    if (to === '/admin/reservations') return counters.bookings_pending;
    if (to === '/admin/projets') return counters.projects_active;
    if (to === '/admin/taches') return counters.tasks_open;
    return 0;
  };

  const { data: notifs } = useQuery({
    queryKey: ['notifications'],
    queryFn: () =>
      apiGet<{ notifications: { id: string; title: string; body: string | null; created_at: string }[]; unread: number }>(
        '/api/v1/admin/notifications',
      ),
    enabled: Boolean(data?.user),
    refetchInterval: 60_000,
  });

  const avatar = data?.user.avatar_url ?? null;
  const who = data?.user.display_name ?? data?.user.full_name ?? data?.user.email ?? '';

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

  async function deleteNotif(id: string) {
    await apiDelete(`/api/v1/admin/notifications/${id}`).catch(() => undefined);
    void qc.invalidateQueries({ queryKey: ['notifications'] });
  }

  async function clearRead() {
    await apiPost('/api/v1/admin/notifications/clear').catch(() => undefined);
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
              <span className="text-brand">5</span>DEV
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
                    <>
                      <ul className="max-h-72 overflow-auto">
                        {(notifs?.notifications ?? []).map((n) => (
                          <li key={n.id} className="group/n relative rounded-lg p-3 pr-8 hover:bg-wash">
                            <p className="text-sm font-medium">{n.title}</p>
                            {n.body && <p className="mt-1 text-xs text-muted">{n.body}</p>}
                            <button
                              type="button"
                              onClick={() => void deleteNotif(n.id)}
                              className="absolute right-2 top-2 grid size-5 place-items-center rounded text-muted opacity-0 transition group-hover/n:opacity-100 hover:text-brand"
                              aria-label={`Supprimer la notification « ${n.title} »`}
                            >
                              <X className="size-3.5" />
                            </button>
                          </li>
                        ))}
                      </ul>
                      <div className="mt-1 flex items-center justify-between border-t border-line pt-2">
                        <button
                          type="button"
                          onClick={() => void markRead()}
                          className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-brand"
                        >
                          <CheckCheck className="size-3.5" /> Tout lire
                        </button>
                        <button
                          type="button"
                          onClick={() => void clearRead()}
                          className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-brand"
                        >
                          <Trash2 className="size-3.5" /> Vider les lues
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            <Link to="/admin/profil" className="group flex items-center gap-2" title="Mon profil">
              {avatar ? (
                <img
                  src={avatar}
                  alt=""
                  width={28}
                  height={28}
                  className="size-7 rounded-full border border-line object-cover"
                />
              ) : (
                <span className="flex size-7 items-center justify-center rounded-full bg-ink text-[10px] font-bold text-white">
                  {who.slice(0, 2).toUpperCase()}
                </span>
              )}
              <span className="hidden max-w-[160px] truncate text-xs text-muted group-hover:text-ink sm:block">{who}</span>
            </Link>
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
          <nav aria-label="Navigation administration" className="admin-nav sticky top-16 p-3">
            {!collapsed && (
              <div className="nav-search">
                <Search className="size-3.5 text-muted" aria-hidden />
                <input
                  value={navQuery}
                  onChange={(e) => setNavQuery(e.target.value)}
                  placeholder="Filtrer les écrans"
                  aria-label="Filtrer les écrans de la console"
                  data-nav-search
                />
                <kbd>/</kbd>
              </div>
            )}
            {GROUPS.map((group) => {
              if (navQuery.trim() && !group.items.some((i) => i.label.toLowerCase().includes(navQuery.trim().toLowerCase()))) return null;
              return (
              <div key={group.title} className="mb-4">
                {!collapsed && (
                  <p className="group-label">{group.title}</p>
                )}
                <ul className="space-y-0.5">
                  {group.items.filter((i) => i.label.toLowerCase().includes(navQuery.trim().toLowerCase())).map((item) => {
                    const Icon = item.icon;
                    return (
                      <li key={item.to}>
                        <NavLink
                          to={item.to}
                          end={item.end}
                          title={collapsed ? item.label : undefined}
                          className="flex items-center gap-2.5"
                        >
                          <Icon className="size-4 shrink-0" aria-hidden />
                          {!collapsed && <span className="truncate">{item.label}</span>}
                          {badgeFor(item.to) > 0 && (
                            <span
                              className={`ml-auto rounded-full bg-brand px-1.5 text-[10px] font-bold leading-4 text-white ${
                                collapsed ? 'absolute right-0.5 top-0.5' : ''
                              }`}
                              aria-label={`${badgeFor(item.to)} en attente`}
                            >
                              {badgeFor(item.to) > 99 ? '99+' : badgeFor(item.to)}
                            </span>
                          )}
                        </NavLink>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ); })}
          </nav>
        </aside>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-7"><div className="mx-auto w-full max-w-[1480px]">
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

          <PageTransition>
            <Outlet />
          </PageTransition>
          </div>
        </main>
      </div>
      <AssistantBubble />
    </div>
  );
}
