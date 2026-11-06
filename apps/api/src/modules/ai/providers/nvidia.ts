import { config } from '../../../config.js';

/**
 * Fournisseur NVIDIA NIM (API compatible OpenAI).
 * Documentation : https://docs.api.nvidia.com/nim/
 * Aucune clé n'est exposée au frontend : tout passe par ce module serveur.
 */
const BASE = process.env.NVIDIA_BASE_URL ?? 'https://integrate.api.nvidia.com/v1';
const KEY = process.env.NVIDIA_API_KEY ?? '';

export const nvidiaReady = (): boolean => Boolean(KEY);

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
  if (!nvidiaReady()) return [];
  const res = await fetch(`${BASE}/models`, {
    headers: { Authorization: `Bearer ${KEY}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new NvidiaError(res.status, `NVIDIA /models → ${res.status}`);
  const json = (await res.json()) as { data?: { id: string }[] };
  return (json.data ?? []).map((m) => m.id);
}

export async function chat(
  model: string,
  messages: ChatMessage[],
  opts: { temperature?: number; maxTokens?: number } = {},
): Promise<ChatResult> {
  if (!nvidiaReady()) throw new NvidiaError(503, 'NVIDIA_API_KEY absente');

  const started = Date.now();
  const res = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: opts.temperature ?? 0.2,
      max_tokens: opts.maxTokens ?? 700,
      stream: false,
    }),
    signal: AbortSignal.timeout(Number(process.env.NVIDIA_TIMEOUT_MS ?? 45_000)),
  });

  const raw = await res.text();
  if (!res.ok) {
    throw new NvidiaError(res.status, `NVIDIA ${res.status} — ${raw.slice(0, 200)}`);
  }

  let json: {
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  try {
    json = JSON.parse(raw);
  } catch {
    throw new NvidiaError(502, 'Réponse NVIDIA illisible');
  }

  const text = json.choices?.[0]?.message?.content?.trim();
  if (!text) throw new NvidiaError(502, 'Réponse NVIDIA vide');

  return {
    text,
    model,
    provider: 'nvidia',
    promptTokens: json.usage?.prompt_tokens ?? null,
    completionTokens: json.usage?.completion_tokens ?? null,
    latencyMs: Date.now() - started,
  };
}

export const nvidiaInfo = () => ({
  ready: nvidiaReady(),
  baseUrl: BASE,
  keyPresent: Boolean(KEY),
  environment: config.NODE_ENV,
});
