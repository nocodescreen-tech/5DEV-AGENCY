import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import {
  Activity,
  Container,
  Cpu,
  Database,
  Loader2,
  Play,
  RefreshCw,
  RotateCw,
  Server,
  Square,
} from 'lucide-react';
import { apiGet, apiPost } from '../../lib/api';
import { PageHeader } from '../../components/admin/PageHeader';
import { SearchInput, Stagger } from '../../components/admin/anim-ui';
import { useToast } from '../../components/Toaster';

type SystemInfo = {
  runtime: { node: string; platform: string; uptime_seconds: number; env: string; port: number };
  database: { state: unknown; version: string; db_size: string; connections: number; started: string };
  counts: { users: number; projects: number; tasks: number; leads: number; secrets: number };
};

type ContainerRow = {
  id: string;
  name: string;
  image: string;
  state: string;
  status: string;
  ports: string;
};

const uptime = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h} h ${String(m).padStart(2, '0')}` : `${m} min`;
};

export default function AdminDev() {
  const qc = useQueryClient();
  const toast = useToast();
  const [query, setQuery] = useState('');

  const system = useQuery({
    queryKey: ['admin', 'system'],
    queryFn: () => apiGet<SystemInfo>('/api/v1/admin/system'),
    refetchInterval: 30_000,
  });

  const docker = useQuery({
    queryKey: ['admin', 'docker'],
    queryFn: () => apiGet<{ available: boolean; message?: string; containers: ContainerRow[] }>(
      '/api/v1/admin/system/docker',
    ),
    refetchInterval: 20_000,
  });

  const act = useMutation({
    mutationFn: (v: { id: string; action: 'start' | 'stop' | 'restart' }) =>
      apiPost(`/api/v1/admin/system/docker/${v.id}/${v.action}`, {}),
    onSuccess: (_d, v) => {
      toast.push('success', `Commande « ${v.action} » envoyée`);
      void qc.invalidateQueries({ queryKey: ['admin', 'docker'] });
    },
    onError: (e: Error) => toast.push('error', e.message),
  });

  const containers = docker.data?.containers ?? [];
  const q = query.trim().toLowerCase();
  const visible = useMemo(
    () => (q ? containers.filter((c) => `${c.name} ${c.image} ${c.state}`.toLowerCase().includes(q)) : containers),
    [containers, q],
  );

  const db = system.data?.database;
  const rt = system.data?.runtime;
  const counts = system.data?.counts;

  return (
    <div>
      <PageHeader
        eyebrow="Développement"
        title="Machine et conteneurs"
        sub="État réel du serveur, de la base et des conteneurs Docker de cette machine"
        actions={
          <>
            <button
              type="button"
              className="btn-ghost !py-2 text-xs"
              onClick={() => {
                void system.refetch();
                void docker.refetch();
              }}
            >
              <RefreshCw className="size-3.5" /> Actualiser
            </button>
          </>
        }
      />

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Node', value: rt?.node ?? '—', hint: rt ? `${rt.platform} · port ${rt.port}` : '', icon: Cpu },
          { label: 'En ligne depuis', value: rt ? uptime(rt.uptime_seconds) : '—', hint: rt ? `mode ${rt.env}` : '', icon: Activity },
          { label: 'PostgreSQL', value: db?.version ?? '—', hint: db ? `${db.db_size} · ${db.connections} connexion(s)` : '', icon: Database },
          { label: 'Conteneurs', value: String(containers.length), hint: docker.data?.available ? 'Docker joignable' : 'Docker arrêté', icon: Container },
        ].map((k, i) => (
          <Stagger key={k.label} index={i} step={60}>
            <div className="panel h-full p-4">
              <div className="flex items-start justify-between">
                <p className="text-[10px] uppercase tracking-wider text-muted">{k.label}</p>
                <k.icon className="size-4 text-muted" aria-hidden />
              </div>
              <p className="mt-1 truncate text-xl font-bold tabular-nums">{k.value}</p>
              {k.hint && <p className="mt-0.5 truncate text-[11px] text-muted">{k.hint}</p>}
            </div>
          </Stagger>
        ))}
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-[1.6fr_1fr]">
        <section className="panel overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3">
            <h2 className="font-semibold">Conteneurs Docker ({visible.length})</h2>
            <SearchInput value={query} onChange={setQuery} placeholder="Filtrer un conteneur…" />
          </div>

          {docker.isPending ? (
            <p className="px-5 py-8 text-sm text-muted">Lecture de Docker…</p>
          ) : !docker.data?.available ? (
            <div className="px-5 py-10 text-center text-muted">
              <Container className="mx-auto mb-3 size-10 opacity-30" />
              <p className="text-sm">{docker.data?.message ?? 'Docker n’est pas joignable.'}</p>
              <p className="mt-1 text-xs">
                Démarrez Docker Desktop, puis actualisez. Cette page n’invente aucun conteneur.
              </p>
            </div>
          ) : visible.length === 0 ? (
            <p className="px-5 py-8 text-sm text-muted">
              {q ? 'Aucun conteneur ne correspond au filtre.' : 'Aucun conteneur sur cette machine.'}
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {visible.map((c, i) => (
                <Stagger as="li" key={c.id} index={i} step={35} className="px-5 py-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-medium">{c.name}</p>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                            c.state === 'running' ? 'bg-emerald/10 text-emerald' : 'bg-muted/10 text-muted'
                          }`}
                        >
                          {c.state === 'running' ? 'en marche' : c.state}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-xs text-muted">{c.image}</p>
                      <p className="mt-0.5 text-[11px] text-muted">
                        {c.status}
                        {c.ports ? ` · ${c.ports}` : ''}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {c.state === 'running' ? (
                        <button
                          type="button"
                          className="btn-ghost !py-1 text-xs"
                          disabled={act.isPending}
                          onClick={() => act.mutate({ id: c.id, action: 'stop' })}
                        >
                          <Square className="size-3.5" /> Arrêter
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn-ghost !py-1 text-xs"
                          disabled={act.isPending}
                          onClick={() => act.mutate({ id: c.id, action: 'start' })}
                        >
                          <Play className="size-3.5" /> Démarrer
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn-ghost !py-1 text-xs"
                        disabled={act.isPending}
                        onClick={() => act.mutate({ id: c.id, action: 'restart' })}
                      >
                        {act.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCw className="size-3.5" />}
                        Redémarrer
                      </button>
                    </div>
                  </div>
                </Stagger>
              ))}
            </ul>
          )}
        </section>

        <div className="space-y-3">
          <section className="panel p-5">
            <h2 className="flex items-center gap-2 font-semibold">
              <Server className="size-4" /> Base de données
            </h2>
            <dl className="mt-3 space-y-2 text-xs">
              {[
                { k: 'Version', v: db?.version ?? '—' },
                { k: 'Taille', v: db?.db_size ?? '—' },
                { k: 'Connexions', v: db ? String(db.connections) : '—' },
                { k: 'Heure serveur', v: db?.started ?? '—' },
              ].map((r) => (
                <div key={r.k} className="flex items-center justify-between gap-3">
                  <dt className="text-muted">{r.k}</dt>
                  <dd className="truncate font-mono">{r.v}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="panel p-5">
            <h2 className="font-semibold">Volumes de données</h2>
            <ul className="mt-3 space-y-2 text-xs">
              {[
                { k: 'Comptes', v: counts?.users ?? 0, to: '/admin/utilisateurs' },
                { k: 'Projets', v: counts?.projects ?? 0, to: '/admin/projets' },
                { k: 'Tâches', v: counts?.tasks ?? 0, to: '/admin/taches' },
                { k: 'Demandes', v: counts?.leads ?? 0, to: '/admin/demandes' },
                { k: 'Clés du coffre', v: counts?.secrets ?? 0, to: '/admin/cles' },
              ].map((r, i) => (
                <Stagger as="li" key={r.k} index={i} step={40} className="flex items-center justify-between gap-3">
                  <span className="text-muted">{r.k}</span>
                  <span className="font-semibold tabular-nums">{r.v}</span>
                </Stagger>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
