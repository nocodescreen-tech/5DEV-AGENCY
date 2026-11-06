import { one, all } from '../../db/index.js';
import { config } from '../../config.js';
import { chat, listModels, nvidiaReady, type ChatMessage } from './providers/nvidia.js';

/**
 * AI GATEWAY — point d'entrée unique pour toute l'IA de 5DEV.
 * Aucun module métier n'appelle un fournisseur directement : il demande une
 * « tâche » (classification, résumé, rédaction…). Changer de modèle ou de
 * fournisseur ne touche donc pas le code métier.
 */

export type AiTask =
  | 'classify_lead'
  | 'summarize'
  | 'draft_reply'
  | 'draft_email'
  | 'draft_newsletter'
  | 'suggest_content'
  | 'extract_lead'
  | 'project_plan';

type TaskConfig = {
  label: string;
  description: string;
  models: string[]; // du moins cher au plus capable
  system: string;
  maxTokens: number;
};

/**
 * Registre des modèles par tâche.
 * Les identifiants sont ceux du catalogue NVIDIA NIM ; `/api/v1/ai/status`
 * vérifie lesquels sont réellement accessibles avec la clé du compte.
 */
export const TASKS: Record<AiTask, TaskConfig> = {
  classify_lead: {
    label: 'Classer une demande',
    description: 'Attribue un pôle et une priorité à une demande entrante.',
    models: ['meta/llama-3.1-8b-instruct', 'mistralai/mistral-nemo-12b-instruct'],
    system:
      'Tu classes des demandes entrantes pour un studio digital (développement web, solutions digitales, croissance digitale, photographie). Réponds uniquement en JSON compact: {"pole":"web|solutions|growth|photo|autre","priorite":"basse|normale|haute","resume":"une phrase"}.',
    maxTokens: 220,
  },
  summarize: {
    label: 'Résumer un échange',
    description: 'Résume un fil de messages en points actionnables.',
    models: ['meta/llama-3.1-8b-instruct', 'nvidia/llama-3.1-nemotron-70b-instruct'],
    system:
      'Tu résumes des échanges professionnels en français, en 3 puces maximum, sans inventer d’information absente du texte.',
    maxTokens: 300,
  },
  draft_reply: {
    label: 'Proposer une réponse client',
    description: 'Rédige un brouillon de réponse à valider par un humain.',
    models: ['nvidia/llama-3.1-nemotron-70b-instruct', 'meta/llama-3.1-8b-instruct'],
    system:
      'Tu rédiges des réponses professionnelles en français pour un studio digital. Ton direct, courtois, sans promesse de prix ni de délai non fournie. Le texte est un brouillon à valider par un humain : ne prétends jamais qu’un envoi a eu lieu.',
    maxTokens: 500,
  },
  draft_email: {
    label: 'Rédiger un email',
    description: 'Produit un email transactionnel à partir d’un contexte.',
    models: ['meta/llama-3.1-8b-instruct', 'nvidia/llama-3.1-nemotron-70b-instruct'],
    system:
      'Tu rédiges des emails transactionnels en français, en texte simple (pas de HTML), maximum 160 mots, avec une seule action attendue du destinataire.',
    maxTokens: 450,
  },
  draft_newsletter: {
    label: 'Rédiger une newsletter',
    description: 'Propose un sujet et un corps de newsletter.',
    models: ['nvidia/llama-3.1-nemotron-70b-instruct', 'meta/llama-3.1-8b-instruct'],
    system:
      'Tu rédiges des newsletters sobres pour un studio digital. Aucune statistique inventée, aucun témoignage inventé. Réponds en JSON: {"sujet":"...","intro":"...","sections":[{"titre":"...","texte":"..."}]}.',
    maxTokens: 900,
  },
  suggest_content: {
    label: 'Suggérer du contenu',
    description: 'Idées de contenus marketing à partir d’un thème.',
    models: ['meta/llama-3.1-8b-instruct'],
    system:
      'Tu proposes des idées de contenus concrets (5 maximum) pour un studio digital en RDC. Pas de promesses de résultats chiffrés.',
    maxTokens: 500,
  },
  project_plan: {
    label: 'Planifier un projet',
    description: 'Transforme un cahier des charges en étapes et tâches.',
    models: ['nvidia/llama-3.1-nemotron-70b-instruct', 'meta/llama-3.1-8b-instruct'],
    system:
      'Tu es chef de projet technique. À partir d’un besoin, propose un plan réaliste. Réponds uniquement en JSON: {"etapes":[{"nom":"...","objectif":"...","taches":["..."]}]} — 4 à 8 étapes, 3 à 6 tâches par étape. Aucune estimation de prix ni de délai chiffré inventé.',
    maxTokens: 1200,
  },
  extract_lead: {
    label: 'Extraire les informations',
    description: 'Transforme un message libre en champs structurés.',
    models: ['meta/llama-3.1-8b-instruct'],
    system:
      'Extrais les informations d’une demande client. Réponds uniquement en JSON: {"besoin":"...","budget_mentionne":"...","delai":"...","contact_prefere":"..."}. Mets null si absent.',
    maxTokens: 300,
  },
};

export type GatewayResult = {
  task: AiTask;
  provider: string;
  model: string;
  text: string;
  latencyMs: number;
  tokens: { prompt: number | null; completion: number | null };
  stubbed: boolean;
};

const promptCache = new Map<string, string>();

async function systemPromptFor(task: AiTask): Promise<string> {
  const cached = promptCache.get(task);
  if (cached) return cached;
  const row = await one<{ template: string }>(`select template from ai_prompts where key = $1`, [`task.${task}`]).catch(
    () => null,
  );
  const prompt = row?.template ?? TASKS[task].system;
  promptCache.set(task, prompt);
  return prompt;
}

/** Réponse de repli déterministe : jamais présentée comme une réponse IA en production. */
function stubAnswer(task: AiTask, input: string): string {
  if (task === 'classify_lead') {
    const t = input.toLowerCase();
    const pole = /photo|mariage|séance|seance|portrait/.test(t)
      ? 'photo'
      : /seo|réseau|reseau|communication|marketing/.test(t)
        ? 'growth'
        : /maintenance|hébergement|hebergement|audit|automat/.test(t)
          ? 'solutions'
          : 'web';
    return JSON.stringify({ pole, priorite: /urgent|rapide|semaine/.test(t) ? 'haute' : 'normale', resume: input.slice(0, 120) });
  }
  if (task === 'extract_lead') {
    return JSON.stringify({ besoin: input.slice(0, 160), budget_mentionne: null, delai: null, contact_prefere: null });
  }
  return `[Mode sans fournisseur IA : clé NVIDIA absente] Tâche « ${task} » non exécutée. Texte reçu : ${input.slice(0, 160)}`;
}

/**
 * Exécute une tâche IA. Journalise systématiquement l'usage (succès, échec,
 * latence) : c'est ce qui rend les quotas et les coûts observables.
 */
export async function runTask(
  task: AiTask,
  input: string,
  opts: { actorId?: string | null } = {},
): Promise<GatewayResult> {
  const cfg = TASKS[task];
  const messages: ChatMessage[] = [
    { role: 'system', content: await systemPromptFor(task) },
    { role: 'user', content: input },
  ];

  // Sans clé : repli explicite en développement, erreur franche en production.
  if (!nvidiaReady()) {
    if (config.NODE_ENV === 'production') {
      throw new Error('Fournisseur IA non configuré (NVIDIA_API_KEY absente).');
    }
    const started = Date.now();
    const text = stubAnswer(task, input);
    await logUsage({ task, provider: 'stub', model: 'repli-deterministe', ok: true, latencyMs: Date.now() - started, actorId: opts.actorId, prompt: null, completion: null });
    return {
      task,
      provider: 'stub',
      model: 'repli-deterministe',
      text,
      latencyMs: Date.now() - started,
      tokens: { prompt: null, completion: null },
      stubbed: true,
    };
  }

  let lastError: unknown = null;
  for (const model of cfg.models) {
    try {
      const res = await chat(model, messages, { maxTokens: cfg.maxTokens });
      await logUsage({
        task,
        provider: res.provider,
        model: res.model,
        ok: true,
        latencyMs: res.latencyMs,
        actorId: opts.actorId,
        prompt: res.promptTokens,
        completion: res.completionTokens,
      });
      return {
        task,
        provider: res.provider,
        model: res.model,
        text: res.text,
        latencyMs: res.latencyMs,
        tokens: { prompt: res.promptTokens, completion: res.completionTokens },
        stubbed: false,
      };
    } catch (err) {
      lastError = err;
      // modèle indisponible ou quota atteint : on tente le suivant du registre
      await logUsage({
        task,
        provider: 'nvidia',
        model,
        ok: false,
        latencyMs: 0,
        actorId: opts.actorId,
        prompt: null,
        completion: null,
        error: err instanceof Error ? err.message.slice(0, 300) : 'erreur inconnue',
      });
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Aucun modèle disponible pour cette tâche.');
}

async function logUsage(args: {
  task: string;
  provider: string;
  model: string;
  ok: boolean;
  latencyMs: number;
  actorId?: string | null;
  prompt: number | null;
  completion: number | null;
  error?: string;
}): Promise<void> {
  await one(
    `insert into ai_usage(task, provider, model, prompt_tokens, completion_tokens, latency_ms, ok, error, actor_id)
     values($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      args.task,
      args.provider,
      args.model,
      args.prompt,
      args.completion,
      args.latencyMs,
      args.ok,
      args.error ?? null,
      args.actorId ?? null,
    ],
  ).catch(() => null);
}

/** État du fournisseur + modèles réellement accessibles. */
export async function aiStatus(): Promise<{
  ready: boolean;
  environment: string;
  provider: string;
  models: string[];
  modelsError: string | null;
  tasks: { task: AiTask; label: string; description: string; models: string[] }[];
  usage: { total: number; ok: number; failed: number; avgLatencyMs: number | null; last24h: number };
}> {
  let models: string[] = [];
  let modelsError: string | null = null;
  if (nvidiaReady()) {
    try {
      models = await listModels();
    } catch (err) {
      modelsError = err instanceof Error ? err.message.slice(0, 200) : 'erreur';
    }
  }

  const stats = await one<Record<string, number>>(
    `select count(*)::int as total,
            count(*) filter (where ok)::int as ok,
            count(*) filter (where not ok)::int as failed,
            round(avg(latency_ms))::int as avg,
            count(*) filter (where created_at > now() - interval '24 hours')::int as last24
       from ai_usage`,
  ).catch(() => null);

  return {
    ready: nvidiaReady(),
    environment: config.NODE_ENV,
    provider: 'nvidia-nim',
    models,
    modelsError,
    tasks: (Object.keys(TASKS) as AiTask[]).map((t) => ({
      task: t,
      label: TASKS[t].label,
      description: TASKS[t].description,
      models: TASKS[t].models,
    })),
    usage: {
      total: Number(stats?.total ?? 0),
      ok: Number(stats?.ok ?? 0),
      failed: Number(stats?.failed ?? 0),
      avgLatencyMs: stats?.avg ?? null,
      last24h: Number(stats?.last24 ?? 0),
    },
  };
}

export async function recentUsage(limit = 50): Promise<Record<string, unknown>[]> {
  return all(
    `select id, task, provider, model, prompt_tokens, completion_tokens, latency_ms, ok, error, created_at
       from ai_usage order by created_at desc limit $1`,
    [limit],
  );
}
