import { readSecret } from '../../../lib/secrets.js';

/**
 * Fournisseur NVIDIA NIM (API compatible OpenAI).
 * Documentation : https://docs.api.nvidia.com/nim/
 *
 * La clé vit exclusivement côté serveur : soit chiffrée en base (table `secrets`,
 * posée depuis la console), soit dans l'environnement. Aucun endpoint ne la renvoie.
 */
const BASE = process.env.NVIDIA_BASE_URL ?? 'https://integrate.api.nvidia.com/v1';

let cached: { key: string; at: number } | null = null;

/** Résout la clé : base chiffrée d'abord, environnement ensuite (cache 30 s). */
export async function resolveKey(): Promise<string> {
  if (cached && Date.now() - cached.at < 30_000) return cached.key;
  const fromDb = await readSecret('nvidia_api_key').catch(() => null);
  const key = fromDb ?? process.env.NVIDIA_API_KEY ?? '';
  cached = { key, at: Date.now() };
  return key;
}

export function invalidateKeyCache(): void {
  cached = null;
}

export async function nvidiaReady(): Promise<boolean> {
  return Boolean(await resolveKey());
}

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export type ChatResult = {
  text: string;
  model: string;
  provider: 'nvidia';
  promptTokens: number | null;
  completionTokens: number | null;
  latencyMs: number;
};

export class NvidiaError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'NvidiaError';
    this.status = status;
  }
}

/** Liste les modèles réellement accessibles avec la clé configurée. */
export async function listModels(): Promise<string[]> {
  const key = await resolveKey();
  if (!key) return [];
  const res = await fetch(`${BASE}/models`, {
    headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new NvidiaError(res.status, `NVIDIA /models → ${res.status}`);
  const json = (await res.json()) as { data?: { id: string }[] };
  return (json.data ?? []).map((m) => m.id);
}

export async function chat(
  model: string,
  messages: ChatMessage[],
  opts: { temperature?: number; maxTokens?: number; timeoutMs?: number } = {},
): Promise<ChatResult> {
  const key = await resolveKey();
  if (!key) throw new NvidiaError(503, 'Aucune clé NVIDIA configurée.');

  const started = Date.now();
  const res = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      temperature: opts.temperature ?? 0.6,
      max_tokens: opts.maxTokens ?? 900,
      stream: false,
    }),
    signal: AbortSignal.timeout(opts.timeoutMs ?? 45_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new NvidiaError(res.status, `NVIDIA ${model} → ${res.status} ${body.slice(0, 180)}`);
  }

  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };

  return {
    text: json.choices?.[0]?.message?.content?.trim() ?? '',
    model,
    provider: 'nvidia',
    promptTokens: json.usage?.prompt_tokens ?? null,
    completionTokens: json.usage?.completion_tokens ?? null,
    latencyMs: Date.now() - started,
  };
}

/**
 * Streaming SSE (OpenAI compatible). Rend des fragments de texte au fur et à mesure.
 * Le consommateur décide de la persistance : rien n'est écrit ici.
 */
export async function* streamChat(
  model: string,
  messages: ChatMessage[],
  opts: { temperature?: number; maxTokens?: number; timeoutMs?: number; signal?: AbortSignal } = {},
): AsyncGenerator<string, void, unknown> {
  const key = await resolveKey();
  if (!key) throw new NvidiaError(503, 'Aucune clé NVIDIA configurée.');

  const res = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: opts.temperature ?? 0.6,
      max_tokens: opts.maxTokens ?? 900,
      stream: true,
    }),
    signal: opts.signal ?? AbortSignal.timeout(opts.timeoutMs ?? 90_000),
  });

  if (!res.ok || !res.body) {
    const body = await res.text().catch(() => '');
    throw new NvidiaError(res.status, `NVIDIA ${model} → ${res.status} ${body.slice(0, 180)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === '[DONE]') return;
      try {
        const json = JSON.parse(payload) as { choices?: { delta?: { content?: string } }[] };
        const delta = json.choices?.[0]?.delta?.content;
        if (delta) yield delta;
      } catch {
        /* fragment non JSON ignoré */
      }
    }
  }
}
