import { Router } from 'express';
import { z } from 'zod';
import { all, one } from '../../db/index.js';
import { AppError } from '../../middlewares/errors.js';
import { requireAdmin, validate } from '../../middlewares/auth.js';
import { TASKS, aiStatus, recentUsage, runTask, type AiTask } from './gateway.js';

export const aiRouter: Router = Router();

aiRouter.get('/admin/ai/status', requireAdmin, async (_req, res, next) => {
  try {
    res.json({ ok: true, data: await aiStatus() });
  } catch (err) {
    next(err);
  }
});

aiRouter.get('/admin/ai/usage', requireAdmin, async (_req, res, next) => {
  try {
    res.json({ ok: true, data: await recentUsage(50) });
  } catch (err) {
    next(err);
  }
});

const runSchema = z.object({
  task: z.enum(Object.keys(TASKS) as [AiTask, ...AiTask[]]),
  input: z.string().min(3).max(8000),
});

/** Exécution réelle d'une tâche IA. Jamais d'action commerciale automatique ici. */
aiRouter.post('/admin/ai/run', requireAdmin, validate(runSchema), async (req, res, next) => {
  try {
    const { task, input } = req.body as z.infer<typeof runSchema>;
    const result = await runTask(task, input, { actorId: req.user?.id ?? null });
    res.json({ ok: true, data: result });
  } catch (err) {
    if (err instanceof Error && /NVIDIA/.test(err.message)) {
      next(new AppError(502, 'AI_PROVIDER_ERROR', err.message.slice(0, 200)));
      return;
    }
    next(err);
  }
});

/* ------------------------------------------------------- prompts éditables */

aiRouter.get('/admin/ai/prompts', requireAdmin, async (_req, res, next) => {
  try {
    const rows = await all<{ key: string; template: string; description: string | null }>(
      `select key, template, description from ai_prompts order by key`,
    );
    res.json({
      ok: true,
      data: rows.length
        ? rows
        : (Object.keys(TASKS) as AiTask[]).map((t) => ({
            key: `task.${t}`,
            template: TASKS[t].system,
            description: TASKS[t].description,
          })),
    });
  } catch (err) {
    next(err);
  }
});

aiRouter.put(
  '/admin/ai/prompts',
  requireAdmin,
  validate(z.object({ key: z.string().min(3).max(80), template: z.string().min(10).max(4000) })),
  async (req, res, next) => {
    try {
      const { key, template } = req.body as { key: string; template: string };
      const row = await one(
        `insert into ai_prompts(key, template) values($1,$2)
         on conflict (key) do update set template = excluded.template, updated_at = now()
         returning key, template`,
        [key, template],
      );
      // le cache du gateway est invalidé au redémarrage ; ici on renvoie l'état enregistré
      res.json({ ok: true, data: row });
    } catch (err) {
      next(err);
    }
  },
);
