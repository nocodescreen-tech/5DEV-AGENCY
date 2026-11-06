import { Router } from 'express';
import { z } from 'zod';
import { all, one } from '../db/index.js';
import { AppError } from '../middlewares/errors.js';
import { requireAdmin, validate } from '../middlewares/auth.js';
import { NvidiaError, listModels, streamChat, type ChatMessage } from './ai/providers/nvidia.js';
import { writeSecret, secretInfo, deleteSecret, readSecret } from '../lib/secrets.js';
import { invalidateKeyCache } from './ai/providers/nvidia.js';

export const aiChatRouter: Router = Router();

/* ------------------------------------------------------------------ limites */

const hits = new Map<string, { n: number; reset: number }>();
function rateLimit(key: string, max = 40, windowMs = 10 * 60_000): void {
  const now = Date.now();
  const cur = hits.get(key);
  if (!cur || cur.reset < now) {
    hits.set(key, { n: 1, reset: now + windowMs });
    return;
  }
  cur.n += 1;
  if (cur.n > max) throw new AppError(429, 'RATE_LIMITED', 'Trop de messages envoyés. Réessayez dans quelques minutes.');
}

/* ----------------------------------------------------------- conversations */

const convSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  model_id: z.string().max(120).nullable().optional(),
  system_prompt: z.string().max(4000).nullable().optional(),
  temperature: z.number().min(0).max(1.5).optional(),
  max_tokens: z.number().int().min(64).max(4096).optional(),
});

aiChatRouter.get('/admin/ai-chat/conversations', requireAdmin, async (req, res, next) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const rows = await all(
      `select c.id, c.title, c.model_id, c.updated_at, c.is_archived,
              (select count(*) from ai_messages m where m.conversation_id=c.id)::int as messages,
              (select left(m.content, 120) from ai_messages m where m.conversation_id=c.id
                order by m.created_at desc limit 1) as last_message
         from ai_conversations c
        where c.user_id = $1 and c.is_archived = false
          and ($2 = '' or c.title ilike '%' || $2 || '%'
               or exists (select 1 from ai_messages m2
                           where m2.conversation_id = c.id and m2.content ilike '%' || $2 || '%'))
        order by c.updated_at desc
        limit 80`,
      [req.user?.id, q],
    );
    res.json({ ok: true, data: rows });
  } catch (err) {
    next(err);
  }
});

aiChatRouter.post('/admin/ai-chat/conversations', requireAdmin, validate(convSchema), async (req, res, next) => {
  try {
    const b = req.body as z.infer<typeof convSchema>;
    const row = await one(
      `insert into ai_conversations(user_id, title, model_id, system_prompt, temperature, max_tokens)
       values($1,$2,$3,$4, coalesce($5, 0.6), coalesce($6, 900))
       returning *`,
      [
        req.user?.id,
        b.title ?? 'Nouvelle conversation',
        b.model_id ?? null,
        b.system_prompt ?? null,
        b.temperature ?? null,
        b.max_tokens ?? null,
      ],
    );
    res.status(201).json({ ok: true, data: row });
  } catch (err) {
    next(err);
  }
});

/** Charge une conversation en vérifiant qu'elle appartient bien à l'appelant. */
async function ownConversation(id: string, userId: string | undefined) {
  const row = await one<{
    id: string;
    title: string;
    model_id: string | null;
    system_prompt: string | null;
    temperature: string;
    max_tokens: number;
  }>(
    `select id, title, model_id, system_prompt, temperature, max_tokens
       from ai_conversations where id=$1 and user_id=$2`,
    [id, userId],
  );
  // 404 et non 403 : on ne révèle pas l'existence d'une conversation d'un autre compte
  if (!row) throw new AppError(404, 'NOT_FOUND', 'Conversation introuvable.');
  return row;
}

aiChatRouter.get('/admin/ai-chat/conversations/:id', requireAdmin, async (req, res, next) => {
  try {
    const conv = await ownConversation(String(req.params.id), req.user?.id);
    const messages = await all(
      `select id, role, content, model, provider, stubbed, latency_ms, error, created_at
         from ai_messages where conversation_id=$1 order by created_at`,
      [conv.id],
    );
    res.json({ ok: true, data: { conversation: conv, messages } });
  } catch (err) {
    next(err);
  }
});

aiChatRouter.patch(
  '/admin/ai-chat/conversations/:id',
  requireAdmin,
  validate(convSchema.partial().extend({ is_archived: z.boolean().optional() })),
  async (req, res, next) => {
    try {
      const conv = await ownConversation(String(req.params.id), req.user?.id);
      const b = req.body as Record<string, unknown>;
      const keys = Object.keys(b);
      if (!keys.length) throw new AppError(422, 'VALIDATION', 'Aucun champ à modifier.');
      const sets = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
      const row = await one(
        `update ai_conversations set ${sets}, updated_at=now() where id=$1 returning *`,
        [conv.id, ...keys.map((k) => b[k])],
      );
      res.json({ ok: true, data: row });
    } catch (err) {
      next(err);
    }
  },
);

aiChatRouter.delete('/admin/ai-chat/conversations/:id', requireAdmin, async (req, res, next) => {
  try {
    const conv = await ownConversation(String(req.params.id), req.user?.id);
    await one(`delete from ai_conversations where id=$1`, [conv.id]);
    res.json({ ok: true, data: { deleted: true } });
  } catch (err) {
    next(err);
  }
});

/** Export markdown de la conversation (données de l'utilisateur, rien d'autre). */
aiChatRouter.get('/admin/ai-chat/conversations/:id/export', requireAdmin, async (req, res, next) => {
  try {
    const conv = await ownConversation(String(req.params.id), req.user?.id);
    const messages = await all<{ role: string; content: string; created_at: string }>(
      `select role, content, created_at from ai_messages where conversation_id=$1 order by created_at`,
      [conv.id],
    );
    const md = [
      `# ${conv.title}`,
      '',
      `_Export du ${new Date().toISOString()} — 5DEV AI CHAT_`,
      '',
      ...messages.map((m) => `## ${m.role === 'user' ? 'Vous' : 'Assistant'}\n\n${m.content}\n`),
    ].join('\n');
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="5dev-conversation-${conv.id.slice(0, 8)}.md"`);
    res.send(md);
  } catch (err) {
    next(err);
  }
});

/* --------------------------------------------------------------- messages */

const messageSchema = z.object({ content: z.string().min(1).max(8000) });

/** Réponse de repli déterministe : jamais présentée comme une réponse du modèle. */
function stubReply(prompt: string): string {
  const p = prompt.toLowerCase();
  if (/devis|prix|co[ûu]t|budget/.test(p)) {
    return "Je n'ai pas de fournisseur IA configuré sur ce poste, je ne peux donc pas rédiger librement.\n\nCe que je peux faire sans modèle : rappeler que les prix se construisent après cadrage (périmètre, nombre de pages, contenus fournis ou non). Le formulaire de devis collecte exactement ces éléments.\n\nPour activer les réponses réelles : Console → IA & modèles → enregistrer une clé NVIDIA, puis tester la connexion.";
  }
  if (/photo|shooting|s[ée]ance|portrait|lumi[èe]re/.test(p)) {
    return "Pas de fournisseur IA configuré : réponse de repli, signalée comme telle.\n\nVérifications photographie qui ne demandent aucun modèle : heure et orientation de la lumière, arrière-plan (pas de poteau dans la tête), liste de prises écrite avant la séance, sauvegarde des fichiers sur deux supports le jour même, livraison dans un format prêt à publier.\n\nPour des réponses générées : Console - IA et modèles - clé NVIDIA, puis test de connexion.";
  }
  if (/bug|erreur|plante|marche pas/.test(p)) {
    return "Pas de fournisseur IA configuré : je réponds en mode dégradé, explicitement signalé.\n\nMéthode utile en attendant : reproduire, isoler (quelle page, quel bouton), regarder la console du navigateur, puis vérifier le journal d'audit côté administration.";
  }
  return "Aucune clé NVIDIA n'est configurée : cette réponse est un repli déterministe, pas une génération du modèle.\n\nDès qu'une clé est enregistrée dans Console → IA & modèles, cet écran streame les réponses réelles du modèle choisi.";
}

/**
 * Envoi d'un message : SSE (text/event-stream).
 * Événements : meta → delta* → done (ou error).
 */
aiChatRouter.post(
  '/admin/ai-chat/conversations/:id/messages',
  requireAdmin,
  validate(messageSchema),
  async (req, res, next) => {
    try {
      const conv = await ownConversation(String(req.params.id), req.user?.id);
      rateLimit(`chat:${req.user?.id}`);

      const { content } = req.body as { content: string };
      const history = await all<{ role: 'user' | 'assistant'; content: string }>(
        `select role, content from ai_messages where conversation_id=$1 order by created_at limit 40`,
        [conv.id],
      );

      await one(`insert into ai_messages(conversation_id, role, content) values($1,'user',$2)`, [conv.id, content]);
      await one(`update ai_conversations set updated_at=now() where id=$1`, [conv.id]);

      // premier message : le titre reprend le début du message (renommable ensuite)
      if (history.length === 0) {
        const title = content.slice(0, 60).replace(/\s+/g, ' ').trim();
        await one(`update ai_conversations set title=$2 where id=$1`, [conv.id, title || 'Nouvelle conversation']);
      }

      const model = conv.model_id ?? 'meta/llama-3.1-8b-instruct';
      const msgs: ChatMessage[] = [
        {
          role: 'system',
          content:
            conv.system_prompt ??
            "Tu es l'assistant interne de 5DEV (agence numérique à Matadi). Tu réponds en français, de façon concise et concrète. Tu n'inventes jamais de prix, de délais, de statistiques ni de témoignages. Si une information manque, tu le dis.",
        },
        ...history,
        { role: 'user', content },
      ];

      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders?.();

      const send = (event: string, data: unknown) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

      const started = Date.now();
      const key = await readSecret('nvidia_api_key');
      const envKey = process.env.NVIDIA_API_KEY ?? '';
      const stubbed = !key && !envKey;

      send('meta', { model, stubbed, conversation_id: conv.id });

      if (stubbed) {
        const text = stubReply(content);
        for (const chunk of text.match(/[\s\S]{1,60}/g) ?? [text]) {
          send('delta', { text: chunk });
          await new Promise((r) => setTimeout(r, 18));
        }
        await one(
          `insert into ai_messages(conversation_id, role, content, model, provider, stubbed, latency_ms)
           values($1,'assistant',$2,$3,'repli',true,$4)`,
          [conv.id, text, model, Date.now() - started],
        );
        send('done', { stubbed: true, latency_ms: Date.now() - started });
        res.end();
        return;
      }

      let full = '';
      try {
        for await (const delta of streamChat(model, msgs, {
          temperature: Number(conv.temperature),
          maxTokens: conv.max_tokens,
        })) {
          full += delta;
          send('delta', { text: delta });
        }
      } catch (err) {
        const status = err instanceof NvidiaError ? err.status : 500;
        const message = err instanceof Error ? err.message : 'Erreur du fournisseur IA.';
        await one(
          `insert into ai_messages(conversation_id, role, content, model, provider, error, latency_ms)
           values($1,'assistant',$2,$3,'nvidia',$4,$5)`,
          [conv.id, full || '_(échec de génération)_', model, message.slice(0, 400), Date.now() - started],
        );
        send('error', {
          status,
          message:
            status === 401 || status === 403
              ? 'Clé NVIDIA refusée : vérifiez la clé dans IA & modèles.'
              : status === 404
                ? 'Modèle introuvable sur ce compte NVIDIA : choisissez un autre modèle.'
                : status === 429
                  ? 'Quota NVIDIA atteint pour ce modèle. Réessayez plus tard ou changez de modèle.'
                  : message,
        });
        res.end();
        return;
      }

      await one(
        `insert into ai_messages(conversation_id, role, content, model, provider, latency_ms)
         values($1,'assistant',$2,$3,'nvidia',$4)`,
        [conv.id, full.trim(), model, Date.now() - started],
      );
      send('done', { stubbed: false, latency_ms: Date.now() - started });
      res.end();
    } catch (err) {
      if (res.headersSent) {
        res.write(`event: error\ndata: ${JSON.stringify({ message: 'Erreur pendant le streaming.' })}\n\n`);
        res.end();
        return;
      }
      next(err);
    }
  },
);

/** Nouvelle tentative : régénère la dernière réponse assistante à partir de l'historique. */
aiChatRouter.post('/admin/ai-chat/conversations/:id/retry', requireAdmin, async (req, res, next) => {
  try {
    const conv = await ownConversation(String(req.params.id), req.user?.id);
    const lastUser = await one<{ content: string }>(
      `select content from ai_messages where conversation_id=$1 and role='user' order by created_at desc limit 1`,
      [conv.id],
    );
    if (!lastUser) throw new AppError(409, 'EMPTY', 'Aucun message à régénérer.');

    // on retire la dernière réponse assistante en échec, puis on rejoue l'envoi
    await one(
      `delete from ai_messages where id = (
         select id from ai_messages where conversation_id=$1 and role='assistant'
          order by created_at desc limit 1)`,
      [conv.id],
    );
    res.json({ ok: true, data: { replay: '/admin/ai-chat/conversations/' + conv.id + '/messages', content: lastUser.content } });
  } catch (err) {
    next(err);
  }
});

/* ------------------------------------------------- gestion des 5 modèles */

aiChatRouter.get('/admin/ai/models', requireAdmin, async (_req, res, next) => {
  try {
    const [rows, info] = await Promise.all([all(`select * from ai_models order by slot`), secretInfo('nvidia_api_key')]);
    const env = Boolean(process.env.NVIDIA_API_KEY);
    res.json({
      ok: true,
      data: {
        models: rows,
        key: {
          ...info,
          configured: info.configured || env,
          source: info.configured ? 'base (chiffrée)' : env ? 'environnement' : 'aucune',
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

aiChatRouter.put(
  '/admin/ai/models/:slot',
  requireAdmin,
  validate(
    z.object({
      model_id: z.string().max(160).nullable(),
      label: z.string().min(2).max(60).optional(),
      capabilities: z.array(z.string().max(30)).max(8).optional(),
      context_window: z.number().int().positive().max(2_000_000).nullable().optional(),
      is_active: z.boolean().optional(),
      is_default: z.boolean().optional(),
      notes: z.string().max(500).nullable().optional(),
    }),
  ),
  async (req, res, next) => {
    try {
      const slot = String(req.params.slot);
      const b = req.body as { model_id: string | null; is_default?: boolean };
      if (b.is_default) await one(`update ai_models set is_default=false where slot <> $1`, [slot]);
      const row = await one(
        `update ai_models set model_id=$2, label=coalesce($3,label), capabilities=coalesce($4::text[],capabilities),
                context_window=coalesce($5,context_window), is_active=coalesce($6,is_active),
                is_default=coalesce($7,is_default), notes=coalesce($8,notes), status='unverified'
          where slot=$1 returning *`,
        [slot, b.model_id, req.body.label ?? null, req.body.capabilities ?? null, req.body.context_window ?? null, req.body.is_active ?? null, req.body.is_default ?? null, req.body.notes ?? null],
      );
      if (!row) throw new AppError(404, 'NOT_FOUND', 'Emplacement inconnu.');
      res.json({ ok: true, data: row });
    } catch (err) {
      next(err);
    }
  },
);

/** Teste un emplacement : appel réel du modèle, statut et latence enregistrés. */
aiChatRouter.post('/admin/ai/models/:slot/test', requireAdmin, async (req, res, next) => {
  try {
    const slot = String(req.params.slot);
    const row = await one<{ model_id: string | null }>(`select model_id from ai_models where slot=$1`, [slot]);
    if (!row?.model_id) throw new AppError(409, 'NO_MODEL', 'Aucun identifiant de modèle enregistré pour cet emplacement.');

    const started = Date.now();
    try {
      const { chat } = await import('./ai/providers/nvidia.js');
      const out = await chat(row.model_id, [{ role: 'user', content: 'Réponds uniquement par OK.' }], {
        maxTokens: 24,
        // premier appel = chargement à froid du modèle côté NVIDIA : marge large
        timeoutMs: 45_000,
      });
      await one(
        `update ai_models set status='verified', last_checked_at=now(), last_error=null where slot=$1`,
        [slot],
      );
      res.json({ ok: true, data: { status: 'verified', latencyMs: out.latencyMs, sample: out.text.slice(0, 80) } });
    } catch (err) {
      const status = err instanceof NvidiaError ? err.status : 500;
      const message = err instanceof Error ? err.message : 'Échec du test.';
      await one(
        `update ai_models set status=$2, last_checked_at=now(), last_error=$3 where slot=$1`,
        [slot, status === 401 || status === 403 || status === 404 ? 'unavailable' : 'unverified', message.slice(0, 300)],
      );
      res.json({
        ok: true,
        data: {
          status: status === 401 || status === 403 || status === 404 ? 'unavailable' : 'unverified',
          latencyMs: Date.now() - started,
          error:
            status === 401 || status === 403
              ? 'Clé refusée par NVIDIA (401/403).'
              : status === 404
                ? 'Modèle inexistant ou non autorisé sur ce compte (404).'
                : status === 429
                  ? 'Quota atteint (429).'
                  : message,
        },
      });
    }
  } catch (err) {
    next(err);
  }
});

/** Liste les modèles réellement accessibles avec la clé courante. */
aiChatRouter.post('/admin/ai/models/sync', requireAdmin, async (_req, res) => {
  try {
    const models = await listModels();
    res.json({ ok: true, data: { count: models.length, models: models.slice(0, 200) } });
  } catch (err) {
    const status = err instanceof NvidiaError ? err.status : 500;
    res.status(status === 401 || status === 403 ? 400 : 502).json({
      ok: false,
      error: {
        code: 'PROVIDER',
        message:
          status === 401 || status === 403
            ? 'Clé NVIDIA refusée : impossible de lister le catalogue.'
            : 'Le catalogue NVIDIA est injoignable pour le moment.',
      },
    });
  }
});

/* ------------------------------------------------------- clé fournisseur */

aiChatRouter.get('/admin/ai/key', requireAdmin, async (_req, res, next) => {
  try {
    const db = await secretInfo('nvidia_api_key');
    const env = Boolean(process.env.NVIDIA_API_KEY);
    res.json({
      ok: true,
      data: {
        // jamais la clé, seulement un indice masqué et l'origine
        configured: db.configured || env,
        source: db.configured ? 'base (chiffrée)' : env ? 'environnement' : 'aucune',
        hint: db.hint,
        updated_at: db.updated_at,
      },
    });
  } catch (err) {
    next(err);
  }
});

aiChatRouter.put(
  '/admin/ai/key',
  requireAdmin,
  validate(z.object({ api_key: z.string().min(20).max(200) })),
  async (req, res, next) => {
    try {
      const { api_key } = req.body as { api_key: string };
      const { hint } = await writeSecret('nvidia_api_key', api_key.trim());
      invalidateKeyCache();
      res.json({ ok: true, data: { saved: true, hint } });
    } catch (err) {
      next(err);
    }
  },
);

aiChatRouter.delete('/admin/ai/key', requireAdmin, async (_req, res, next) => {
  try {
    await deleteSecret('nvidia_api_key');
    invalidateKeyCache();
    res.json({ ok: true, data: { deleted: true } });
  } catch (err) {
    next(err);
  }
});
