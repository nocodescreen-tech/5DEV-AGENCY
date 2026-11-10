import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Info, RefreshCw, Sparkles, X } from 'lucide-react';
import { apiGet } from '../lib/api';

type Insight = {
  id: string;
  tone: 'urgent' | 'attention' | 'info';
  title: string;
  detail: string;
  link: string;
  cta: string;
};
type AssistantData = { generated_at: string; cached: boolean; insights: Insight[] };

const TONE = {
  urgent: { box: 'border-brand/40 bg-brand/5', chip: 'text-brand', Icon: AlertTriangle },
  attention: { box: 'border-amber-300/60 bg-amber-50', chip: 'text-amber-700', Icon: AlertTriangle },
  info: { box: 'border-line bg-wash', chip: 'text-muted', Icon: Info },
} as const;

const ilYA = (iso: string) => {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  return `il y a ${h} h`;
};

/**
 * Bulle d'assistant disponible sur tous les écrans de la console.
 * Les constats viennent de GET /admin/ai/assistant : analyse SQL côté serveur, recalculée
 * toutes les 10 minutes (cache serveur + refetchInterval client). Aucun token consommé.
 */
export function AssistantBubble() {
  const [open, setOpen] = useState(() => localStorage.getItem('five.assistant.open') === '1');

  const { data, isFetching, refetch } = useQuery({
    queryKey: ['ai-assistant'],
    queryFn: () => apiGet<AssistantData>('/api/v1/admin/ai/assistant'),
    refetchInterval: 10 * 60_000,
    staleTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    localStorage.setItem('five.assistant.open', open ? '1' : '0');
  }, [open]);

  const insights = data?.insights ?? [];
  const urgent = insights.filter((i) => i.tone === 'urgent').length;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3 print:hidden">
      {open && (
        <section
          aria-label="Suggestions de l’assistant"
          className="assistant-panel w-[min(24rem,calc(100vw-2.5rem))] overflow-hidden rounded-2xl border border-line bg-paper shadow-xl"
        >
          <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-sm font-semibold">
                <Sparkles className="size-3.5 text-brand" /> Assistant 5DEV
              </p>
              <p className="text-[11px] text-muted">
                {data ? `Analyse ${ilYA(data.generated_at)}` : 'Analyse en cours…'} · toutes les 10 min
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => void refetch()}
                disabled={isFetching}
                title="Relancer l’analyse"
                className="rounded-md p-1.5 text-muted hover:bg-wash hover:text-ink disabled:opacity-40"
              >
                <RefreshCw className={`size-3.5 ${isFetching ? 'animate-spin' : ''}`} />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                title="Masquer"
                className="rounded-md p-1.5 text-muted hover:bg-wash hover:text-ink"
              >
                <X className="size-3.5" />
              </button>
            </div>
          </header>

          <div className="max-h-[min(60vh,26rem)] space-y-2 overflow-auto p-3">
            {insights.length === 0 && (
              <p className="flex items-start gap-2 rounded-xl border border-line bg-wash p-3 text-xs text-muted">
                <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
                Rien à signaler : aucune tâche en retard, aucune demande en attente. Bonne journée.
              </p>
            )}
            {insights.map((i) => {
              const tone = TONE[i.tone];
              return (
                <article key={i.id} className={`rounded-xl border p-3 ${tone.box}`}>
                  <p className="flex items-start gap-1.5 text-xs font-medium text-ink">
                    <tone.Icon className={`mt-0.5 size-3.5 shrink-0 ${tone.chip}`} />
                    {i.title}
                  </p>
                  <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted">{i.detail}</p>
                  <Link
                    to={i.link}
                    onClick={() => setOpen(false)}
                    className="mt-1.5 inline-block text-[11px] font-medium text-brand hover:underline"
                  >
                    {i.cta} →
                  </Link>
                </article>
              );
            })}
          </div>

          <footer className="border-t border-line px-3 py-2">
            <Link
              to="/admin/ia/chat"
              onClick={() => setOpen(false)}
              className="text-[11px] text-muted hover:text-brand"
            >
              Poser une question à l’assistant (mode agent) →
            </Link>
          </footer>
        </section>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? 'Fermer l’assistant' : 'Ouvrir l’assistant'}
        className="assistant-fab relative grid size-14 place-items-center rounded-full bg-brand text-white shadow-lg transition hover:scale-[1.04] active:scale-95"
      >
        <Sparkles className="size-6" />
        {!open && insights.length > 0 && (
          <span
            className={`absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full px-1 text-[10px] font-semibold tabular-nums ${
              urgent > 0 ? 'bg-ink text-white' : 'bg-white text-brand ring-1 ring-brand/40'
            }`}
          >
            {insights.length}
          </span>
        )}
      </button>
    </div>
  );
}
