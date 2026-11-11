import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../../lib/api';
import { GitBranch, RefreshCw, ExternalLink, AlertTriangle, CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react';
import { SearchInput, Stagger } from '../../components/admin/anim-ui';

type GitHubRepo = {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  url: string;
  description: string | null;
  updated_at: string;
  pushed_at: string;
  stars: number;
  language: string | null;
};

type WorkflowRun = {
  id: number;
  name: string;
  repo: string;
  branch: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion: 'success' | 'failure' | 'cancelled' | 'skipped' | 'timed_out' | 'action_required' | null;
  created_at: string;
  url: string;
};

type GitHubData = {
  repos: GitHubRepo[];
  runs: WorkflowRun[];
  stats?: {
    total_repos: number;
    recent_runs: number;
    failed_runs: number;
  };
  message?: string;
};
function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function StatusBadge({ status, conclusion }: { status: WorkflowRun['status']; conclusion: WorkflowRun['conclusion'] }) {
  if (status === 'in_progress') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-brand/10 text-brand text-xs font-medium"><Loader2 className="size-3 animate-spin" /> En cours</span>;
  if (status === 'queued') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-muted/10 text-muted text-xs font-medium"><Clock className="size-3" /> En attente</span>;
  if (conclusion === 'success') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald/10 text-emerald text-xs font-medium"><CheckCircle className="size-3" /> Succès</span>;
  if (conclusion === 'failure') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red/10 text-red text-xs font-medium"><XCircle className="size-3" /> Échec</span>;
  if (conclusion === 'cancelled') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-orange/10 text-orange text-xs font-medium"><AlertTriangle className="size-3" /> Annulé</span>;
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-muted/10 text-muted text-xs font-medium">{conclusion || status}</span>;
}

function LanguageColor(lang: string | null) {
  const colors: Record<string, string> = {
    TypeScript: '#3178C6',
    JavaScript: '#F7DF1E',
    Python: '#3776AB',
    Rust: '#DEA584',
    Go: '#00ADD8',
    HTML: '#E34F26',
    CSS: '#1572B6',
    PHP: '#777BB4',
    Ruby: '#CC342D',
    Java: '#ED8B00',
    C: '#555555',
    'C++': '#00599C',
    CSharp: '#239120',
    Shell: '#89E051',
    Vue: '#42B883',
    Svelte: '#FF3E00',
    Swift: '#FA7343',
    Kotlin: '#7F52FF',
    Dart: '#0175C2',
    Dockerfile: '#2496ED',
    Makefile: '#427819',
  };
  return colors[lang || ''] || '#888';
}

export default function AdminGitHub() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'github'],
    queryFn: () => apiGet<GitHubData>('/api/v1/admin/pages'),
  });

  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();

  const reposVisible = useMemo(() => {
    const rows = data?.repos ?? [];
    if (!q) return rows;
    return rows.filter((r) => `${r.full_name} ${r.description ?? ''} ${r.language ?? ''}`.toLowerCase().includes(q));
  }, [data, q]);

  const runsVisible = useMemo(() => {
    const rows = data?.runs ?? [];
    if (!q) return rows;
    return rows.filter((r) => `${r.name} ${r.repo} ${r.branch} ${r.conclusion ?? ''}`.toLowerCase().includes(q));
  }, [data, q]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Projets GitHub</h1>
            <p className="text-muted mt-1">Repositories, workflows et runs récents</p>
          </div>
          <button disabled type="button" className="btn-primary"><Loader2 className="size-4 animate-spin mr-2" />Chargement…</button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-xl bg-ink/[0.06]" />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-xl border border-red/30 bg-red/5 p-6">
        <h2 className="font-semibold text-red">Impossible de charger les données GitHub</h2>
        <p className="text-sm text-muted mt-2">Vérifiez la configuration du token GitHub.</p>
      </div>
    );
  }

  const message = data?.message;
  // L'API omet `stats` quand aucun token n'est configuré : ne jamais déréférencer à l'aveugle.
  const stats = data?.stats ?? { total_repos: 0, recent_runs: 0, failed_runs: 0 };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Projets GitHub</h1>
          <p className="text-muted mt-1">Repositories, workflows et runs récents</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput value={query} onChange={setQuery} placeholder="Rechercher un dépôt, un run…" />
          {message && (
            <span className="max-w-[16rem] truncate text-xs text-muted px-3 py-1 rounded bg-muted/10" title={message}>
              {message}
            </span>
          )}
          <button onClick={() => refetch()} type="button" className="btn-ghost" aria-label="Actualiser">
            <RefreshCw className="size-4" />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-line bg-paper p-5">
          <p className="text-xs uppercase tracking-wide text-muted">Total Repos</p>
          <p className="text-3xl font-bold mt-1">{stats.total_repos}</p>
        </div>
        <div className="rounded-xl border border-line bg-paper p-5">
          <p className="text-xs uppercase tracking-wide text-muted">Runs récents</p>
          <p className="text-3xl font-bold mt-1">{stats.recent_runs}</p>
        </div>
        <div className="rounded-xl border border-line bg-paper p-5">
          <p className="text-xs uppercase tracking-wide text-muted">Échecs</p>
          <p className="text-3xl font-bold mt-1 text-red">{stats.failed_runs}</p>
        </div>
      </div>

      {/* Repositories */}
      <section className="rounded-xl border border-line bg-paper overflow-hidden">
        <div className="border-b border-line px-5 py-3 flex items-center justify-between">
          <h2 className="font-semibold flex items-center gap-2"><GitBranch className="size-5" /> Repositories ({reposVisible.length})</h2>
        </div>
        {reposVisible.length === 0 ? (
          <div className="p-10 text-center text-muted">
            <GitBranch className="size-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg">{q ? 'Aucun dépôt ne correspond' : 'Aucun repository trouvé'}</p>
            <p className="text-sm mt-1">
              {q ? 'Modifiez la recherche.' : 'Ajoutez la clé github_token dans la console pour voir vos dépôts.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-line">
            {reposVisible.map((repo, i) => (
              <Stagger key={repo.id} index={i} step={45} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-wash transition">
                <div className="flex items-start gap-3 min-w-0">
                  <GitBranch className="size-5 text-muted shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <a href={repo.url} target="_blank" rel="noopener noreferrer" className="font-medium truncate hover:text-brand">{repo.full_name}</a>
                      {repo.private && <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted/10 text-muted font-medium">Privé</span>}
                    </div>
                    {repo.description && <p className="text-sm text-muted mt-1 truncate">{repo.description}</p>}
                    <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-muted">
                      {repo.language && (
                        <span className="flex items-center gap-1">
                          <span className="size-2 rounded-full" style={{ backgroundColor: LanguageColor(repo.language) }} />
                          {repo.language}
                        </span>
                      )}
                      {repo.stars > 0 && <span>★ {repo.stars}</span>}
                      <span>MAJ: {formatDate(repo.updated_at)}</span>
                      <span>Push: {formatDate(repo.pushed_at)}</span>
                    </div>
                  </div>
                </div>
                <a href={repo.url} target="_blank" rel="noopener noreferrer" className="btn-ghost shrink-0"><ExternalLink className="size-4" /></a>
              </Stagger>
            ))}
          </div>
        )}
      </section>

      {/* Workflow Runs */}
      <section className="rounded-xl border border-line bg-paper overflow-hidden">
        <div className="border-b border-line px-5 py-3 flex items-center justify-between">
          <h2 className="font-semibold flex items-center gap-2"><GitBranch className="size-5" /> Workflow Runs récents ({runsVisible.length})</h2>
        </div>
        {runsVisible.length === 0 ? (
          <div className="p-10 text-center text-muted">
            <GitBranch className="size-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg">{q ? 'Aucun run ne correspond' : 'Aucun run récent'}</p>
            <p className="text-sm mt-1">
              {q ? 'Modifiez la recherche.' : 'Les runs apparaîtront ici quand le token sera configuré.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-line">
            {runsVisible.map((run, i) => (
              <Stagger key={run.id} index={i} step={45} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-wash transition">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <a href={run.url} target="_blank" rel="noopener noreferrer" className="font-medium truncate hover:text-brand">{run.name}</a>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted/10 text-muted font-medium">{run.repo}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted/10 text-muted font-medium">{run.branch}</span>
                      <StatusBadge status={run.status} conclusion={run.conclusion} />
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-muted">
                      <span>{formatDate(run.created_at)}</span>
                    </div>
                  </div>
                </div>
                <a href={run.url} target="_blank" rel="noopener noreferrer" className="btn-ghost shrink-0"><ExternalLink className="size-4" /></a>
              </Stagger>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}