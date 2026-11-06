import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowDownToLine,
  Check,
  Copy,
  Loader2,
  MessageSquarePlus,
  Pencil,
  RefreshCw,
  Search,
  Send,
  Trash2,
} from 'lucide-react';
import { apiDelete, apiGet, apiPatch, apiPost, ApiRequestError } from '../../lib/api';
import { Markdown } from '../../components/Markdown';
import { useToast } from '../../components/Toaster';
import { EmptyState, Skeleton } from '../../components/ui';

type Conversation = {
  id: string;
  title: string;
  model_id: string | null;
  updated_at: string;
  messages: number;
  last_message: string | null;
};

type Message = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  model: string | null;
  stubbed: boolean;
  latency_ms: number | null;
  error: string | null;
  created_at: string;
};

type Model = { slot: string; label: string; model_id: string | null; status: string; is_default: boolean };

const SLOT_LABEL: Record<string, string> = {
  general: 'Généraliste',
  reasoning: 'Raisonnement',
  code: 'Programmation',
  fast: 'Rapide',
  multimodal: 'Multimodal',
};

export default function AdminAIChat() {
  const qc = useQueryClient();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [liveText, setLiveText] = useState('');
  const [liveMeta, setLiveMeta] = useState<{ model?: string; stubbed?: boolean }>({});
  const [chatError, setChatError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const { data: conversations, isPending: loadingList } = useQuery({
    queryKey: ['ai-conv', search],
    queryFn: () => apiGet<Conversation[]>(`/api/v1/admin/ai-chat/conversations?q=${encodeURIComponent(search)}`),
  });

  const { data: models } = useQuery({
    queryKey: ['ai-models'],
    queryFn: () => apiGet<{ models: Model[]; key: { configured: boolean } }>('/api/v1/admin/ai/models'),
  });

  const { data: current } = useQuery({
    queryKey: ['ai-conv-detail', activeId],
    queryFn: () => apiGet<{ conversation: Conversation & { model_id: string | null }; messages: Message[] }>(
      `/api/v1/admin/ai-chat/conversations/${activeId}`,
    ),
    enabled: Boolean(activeId),
  });

  const availableModels = useMemo(
    () => (models?.models ?? []).filter((m) => Boolean(m.model_id)),
    [models],
  );

  useEffect(() => {
    const first = conversations?.[0];
    if (!activeId && first) setActiveId(first.id);
  }, [conversations, activeId]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [current?.messages, liveText]);

  const createConversation = useCallback(async () => {
    const def = availableModels.find((m) => m.is_default) ?? availableModels[0];
    const conv = await apiPost<{ id: string }>('/api/v1/admin/ai-chat/conversations', {
      model_id: def?.model_id ?? null,
    });
    setActiveId(conv.id);
    await qc.invalidateQueries({ queryKey: ['ai-conv'] });
  }, [availableModels, qc]);

  async function send() {
    if (!draft.trim() || streaming) return;
    const id = activeId;
    if (!id) {
      await createConversation();
      return;
    }
    const content = draft.trim();
    setDraft('');
    setChatError(null);
    setLiveText('');
    setStreaming(true);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch(`/api/v1/admin/ai-chat/conversations/${id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
        credentials: 'include',
        signal: ctrl.signal,
      });

      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => null);
        throw new ApiRequestError(res.status, body?.error?.code ?? 'ERROR', body?.error?.message ?? 'Envoi impossible.');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let acc = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() ?? '';

        for (const evt of events) {
          const lines = evt.split('\n');
          const event = lines.find((l) => l.startsWith('event:'))?.slice(6).trim();
          const dataLine = lines.find((l) => l.startsWith('data:'))?.slice(5).trim();
          if (!dataLine) continue;
          const payload = JSON.parse(dataLine) as { text?: string; model?: string; stubbed?: boolean; message?: string };

          if (event === 'meta') setLiveMeta({ model: payload.model, stubbed: payload.stubbed });
          if (event === 'delta') {
            acc += payload.text ?? '';
            setLiveText(acc);
          }
          if (event === 'error') setChatError(payload.message ?? 'Erreur du fournisseur.');
        }
      }
      await qc.invalidateQueries({ queryKey: ['ai-conv-detail', id] });
      await qc.invalidateQueries({ queryKey: ['ai-conv'] });
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setChatError(err instanceof ApiRequestError ? err.message : 'Connexion interrompue.');
      }
    } finally {
      setStreaming(false);
      setLiveText('');
      abortRef.current = null;
    }
  }

  async function retry() {
    if (!activeId) return;
    try {
      const r = await apiPost<{ content: string }>(`/api/v1/admin/ai-chat/conversations/${activeId}/retry`);
      setDraft(r.content);
      setChatError(null);
      await qc.invalidateQueries({ queryKey: ['ai-conv-detail', activeId] });
    } catch (err) {
      setChatError(err instanceof ApiRequestError ? err.message : 'Nouvelle tentative impossible.');
    }
  }

  async function changeModel(modelId: string) {
    if (!activeId) return;
    await apiPatch(`/api/v1/admin/ai-chat/conversations/${activeId}`, { model_id: modelId });
    await qc.invalidateQueries({ queryKey: ['ai-conv-detail', activeId] });
    toast.push('success', 'Modèle de la conversation mis à jour.');
  }

  async function rename(id: string) {
    const title = renameValue.trim();
    if (title.length < 1) return;
    await apiPatch(`/api/v1/admin/ai-chat/conversations/${id}`, { title });
    setRenaming(null);
    await qc.invalidateQueries({ queryKey: ['ai-conv'] });
  }

  async function remove(id: string) {
    if (!confirm('Supprimer définitivement cette conversation ?')) return;
    await apiDelete(`/api/v1/admin/ai-chat/conversations/${id}`);
    if (activeId === id) setActiveId(null);
    await qc.invalidateQueries({ queryKey: ['ai-conv'] });
    toast.push('success', 'Conversation supprimée.');
  }

  async function copy(text: string, id: string) {
    await navigator.clipboard?.writeText(text);
    setCopied(id);
    window.setTimeout(() => setCopied(null), 1600);
  }

  const messages = current?.messages ?? [];
  const noProvider = models ? !models.key.configured : false;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">5DEV AI Chat</h1>
          <p className="mt-1 text-sm text-muted">
            Conversations persistées, réponses en streaming. La clé NVIDIA reste sur le serveur.
          </p>
        </div>
        <button type="button" className="btn-primary !px-4 !py-2.5 text-sm" onClick={() => void createConversation()}>
          <MessageSquarePlus className="size-4" /> Nouvelle conversation
        </button>
      </div>

      {noProvider && (
        <p className="mt-4 rounded-lg border border-brand/40 bg-brand/5 p-3 text-sm">
          Aucune clé NVIDIA enregistrée : les réponses sont un <strong>repli déterministe</strong>, marqué comme tel.
          Ajoutez une clé dans <em>IA &amp; modèles</em> pour obtenir de vraies générations.
        </p>
      )}

      <div className="mt-5 grid gap-4 lg:grid-cols-[280px_1fr]">
        {/* ---------------------------------------------------- liste */}
        <aside className="card flex max-h-[70vh] flex-col overflow-hidden">
          <div className="border-b border-line p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 size-3.5 text-muted" aria-hidden />
              <input
                className="field !py-2 pl-8 text-xs"
                placeholder="Rechercher…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Rechercher une conversation"
              />
            </div>
          </div>

          <ul className="flex-1 overflow-auto">
            {loadingList && (
              <li className="p-3">
                <Skeleton className="h-12" />
              </li>
            )}
            {(conversations ?? []).map((c) => (
              <li key={c.id} className="border-b border-line/60">
                <div
                  className={`group flex items-start gap-1 px-3 py-2.5 ${activeId === c.id ? 'bg-brand/5' : 'hover:bg-wash'}`}
                >
                  <button type="button" onClick={() => setActiveId(c.id)} className="min-w-0 flex-1 text-left">
                    {renaming === c.id ? (
                      <input
                        autoFocus
                        className="field !py-1 text-xs"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={() => void rename(c.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') void rename(c.id);
                          if (e.key === 'Escape') setRenaming(null);
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <>
                        <p className={`truncate text-sm ${activeId === c.id ? 'font-semibold' : ''}`}>{c.title}</p>
                        <p className="truncate text-[11px] text-muted">
                          {c.messages} message(s)
                          {c.last_message ? ` · ${c.last_message}` : ''}
                        </p>
                      </>
                    )}
                  </button>
                  <div className="flex shrink-0 gap-1 opacity-0 transition group-hover:opacity-100">
                    <button
                      type="button"
                      aria-label="Renommer"
                      className="p-1 text-muted hover:text-brand"
                      onClick={() => {
                        setRenaming(c.id);
                        setRenameValue(c.title);
                      }}
                    >
                      <Pencil className="size-3" />
                    </button>
                    <button
                      type="button"
                      aria-label="Supprimer"
                      className="p-1 text-muted hover:text-brand"
                      onClick={() => void remove(c.id)}
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
            {!loadingList && (conversations ?? []).length === 0 && (
              <li className="p-4 text-xs text-muted">Aucune conversation{search ? ' pour cette recherche' : ''}.</li>
            )}
          </ul>
        </aside>

        {/* --------------------------------------------------- fil */}
        <section className="card flex max-h-[70vh] min-h-[520px] flex-col overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5">
            <div className="flex items-center gap-2">
              <select
                className="field !w-auto !py-1.5 text-xs"
                value={current?.conversation.model_id ?? ''}
                onChange={(e) => void changeModel(e.target.value)}
                aria-label="Modèle de la conversation"
                disabled={!activeId}
              >
                <option value="">modèle par défaut</option>
                {availableModels.map((m) => (
                  <option key={m.slot} value={m.model_id ?? ''}>
                    {SLOT_LABEL[m.slot] ?? m.slot} — {m.model_id}
                    {m.status === 'verified' ? ' ✓' : ''}
                  </option>
                ))}
              </select>
              {availableModels.length === 0 && (
                <span className="text-[11px] text-muted">Aucun modèle enregistré — voir IA &amp; modèles</span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {activeId && (
                <a
                  href={`/api/v1/admin/ai-chat/conversations/${activeId}/export`}
                  className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-brand"
                >
                  <ArrowDownToLine className="size-3.5" /> Exporter
                </a>
              )}
              <button
                type="button"
                onClick={() => void retry()}
                disabled={!activeId || streaming}
                className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-brand disabled:opacity-40"
              >
                <RefreshCw className="size-3.5" /> Régénérer
              </button>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-4 overflow-auto px-4 py-4">
            {!activeId && (
              <EmptyState
                title="Aucune conversation ouverte"
                description="Créez une conversation pour interroger le modèle. L’historique reste disponible à gauche, et rien ne part sans votre envoi."
                action={
                  <button type="button" className="btn-primary" onClick={() => void createConversation()}>
                    Démarrer
                  </button>
                }
              />
            )}

            {messages.map((m) => (
              <div key={m.id} className={m.role === 'user' ? 'flex justify-end' : ''}>
                <div
                  className={`max-w-[85%] rounded-xl px-3.5 py-2.5 ${
                    m.role === 'user' ? 'bg-ink text-white' : 'border border-line bg-wash'
                  }`}
                >
                  {m.role === 'assistant' ? (
                    <>
                      <Markdown text={m.content} />
                      <div className="mt-2 flex items-center gap-3 text-[10px] text-muted">
                        {m.model && <span className="font-mono">{m.model}</span>}
                        {m.stubbed && <span className="text-brand">repli sans fournisseur</span>}
                        {m.latency_ms != null && <span>{m.latency_ms} ms</span>}
                        <button
                          type="button"
                          onClick={() => void copy(m.content, m.id)}
                          className="inline-flex items-center gap-1 hover:text-brand"
                        >
                          {copied === m.id ? <Check className="size-3" /> : <Copy className="size-3" />}
                          {copied === m.id ? 'copié' : 'copier'}
                        </button>
                      </div>
                      {m.error && <p className="mt-1 text-[11px] text-brand">{m.error}</p>}
                    </>
                  ) : (
                    <p className="whitespace-pre-wrap text-sm">{m.content}</p>
                  )}
                </div>
              </div>
            ))}

            {streaming && (
              <div className="max-w-[85%]">
                <div className="rounded-xl border border-line bg-wash px-3.5 py-2.5">
                  {liveText ? (
                    <Markdown text={liveText} />
                  ) : (
                    <p className="flex items-center gap-2 text-sm text-muted">
                      <Loader2 className="size-3.5 animate-spin" /> Le modèle réfléchit…
                    </p>
                  )}
                  {liveMeta.stubbed && <p className="mt-2 text-[10px] text-brand">repli sans fournisseur IA</p>}
                </div>
              </div>
            )}

            {chatError && (
              <div className="rounded-lg border border-brand/40 bg-brand/5 p-3 text-sm">
                {chatError}
                <button type="button" onClick={() => void retry()} className="ml-2 font-medium text-brand underline">
                  Réessayer
                </button>
              </div>
            )}
          </div>

          <form
            className="border-t border-line p-3"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <div className="flex items-end gap-2">
              <textarea
                className="field min-h-[44px] flex-1 resize-y text-sm"
                placeholder={activeId ? 'Votre message… (Entrée pour envoyer, Maj+Entrée pour un retour ligne)' : 'Créez une conversation pour commencer'}
                value={draft}
                disabled={!activeId || streaming}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
                rows={1}
                aria-label="Message"
              />
              <button type="submit" className="btn-primary !px-4 !py-3" disabled={!activeId || streaming || !draft.trim()}>
                {streaming ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                <span className="sr-only">Envoyer</span>
              </button>
            </div>
            <p className="mt-1.5 text-[10px] text-muted">
              Les réponses sont générées par le modèle choisi et peuvent contenir des erreurs. Aucune action
              (devis, facture, email) n’est déclenchée automatiquement.
            </p>
          </form>
        </section>
      </div>
    </div>
  );
}
