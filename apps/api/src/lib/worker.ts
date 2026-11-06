import { all, one } from '../db/index.js';

/**
 * Worker en processus : traite les tâches différées (envois d'emails de masse,
 * automatisations) sans bloquer les requêtes HTTP.
 * Volontairement simple (pas de Redis) : une table `jobs` + un intervalle.
 * Suffisant pour un studio ; remplaçable par BullMQ sans toucher aux métiers.
 */

type Job = { id: string; kind: string; payload: Record<string, unknown>; attempts: number; max_attempts: number };

let running = false;
let timer: NodeJS.Timeout | null = null;

async function claim(limit = 10): Promise<Job[]> {
  return all<Job>(
    `with ready as (
       select id from jobs
        where status = 'pending' and run_at <= now()
        order by run_at
        limit $1
        for update skip locked
     )
     update jobs j set status='running', locked_at=now(), attempts=j.attempts+1, updated_at=now()
       from ready
      where j.id = ready.id
      returning j.id, j.kind, j.payload, j.attempts, j.max_attempts`,
    [limit],
  );
}

async function finish(id: string, ok: boolean, error?: string): Promise<void> {
  if (ok) {
    await one(`update jobs set status='done', last_error=null, updated_at=now() where id=$1`, [id]);
    return;
  }
  // reprise avec backoff si des tentatives restent
  await one(
    `update jobs set
       status = case when attempts >= max_attempts then 'failed' else 'pending' end,
       last_error = $2,
       run_at = now() + (interval '30 seconds' * greatest(attempts,1)),
       updated_at = now()
     where id = $1`,
    [id, error ?? null],
  );
}

async function handle(job: Job): Promise<void> {
  switch (job.kind) {
    case 'email.send': {
      const { sendEmail } = await import('./email.js');
      const p = job.payload as { to?: string; subject?: string; html?: string; text?: string };
      if (!p.to || !p.subject || !p.html) throw new Error('payload email incomplet');
      const res = await sendEmail({ to: p.to, subject: p.subject, html: p.html, text: p.text });
      if (!res.ok) throw new Error(res.error);
      return;
    }
    case 'automation.run': {
      const { runAutomations } = await import('../modules/automation.js');
      const p = job.payload as { trigger?: string; payload?: Record<string, unknown> };
      if (!p.trigger) throw new Error('déclencheur manquant');
      await runAutomations(p.trigger as 'lead.created' | 'booking.created', p.payload ?? {});
      return;
    }
    default:
      throw new Error(`type de tâche inconnu : ${job.kind}`);
  }
}

async function tick(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const jobs = await claim();
    for (const job of jobs) {
      try {
        await handle(job);
        await finish(job.id, true);
      } catch (err) {
        await finish(job.id, false, err instanceof Error ? err.message.slice(0, 300) : 'erreur');
      }
    }
  } catch {
    /* la base peut être momentanément indisponible : on réessaiera au prochain tick */
  } finally {
    running = false;
  }
}

export function startWorker(intervalMs = 5000): void {
  if (timer) return;
  timer = setInterval(() => void tick(), intervalMs);
  timer.unref();
}

export function stopWorker(): void {
  if (timer) clearInterval(timer);
  timer = null;
}

/** Met une tâche en file (utilisé par les campagnes et les automatisations). */
export async function enqueue(kind: string, payload: Record<string, unknown>, delaySeconds = 0): Promise<string | null> {
  const row = await one<{ id: string }>(
    `insert into jobs(kind, payload, run_at) values($1,$2::jsonb, now() + ($3 || ' seconds')::interval) returning id`,
    [kind, JSON.stringify(payload), String(delaySeconds)],
  );
  return row?.id ?? null;
}

export async function emailStats(): Promise<{ queued: number; sent: number; failed: number; jobs: number }> {
  const row = await one<Record<string, number>>(
    `select
       count(*) filter (where status='queued')::int as queued,
       count(*) filter (where status='sent')::int as sent,
       count(*) filter (where status='failed')::int as failed,
       (select count(*) from jobs where status='pending')::int as jobs
     from email_outbox`,
  );
  return {
    queued: Number(row?.queued ?? 0),
    sent: Number(row?.sent ?? 0),
    failed: Number(row?.failed ?? 0),
    jobs: Number(row?.jobs ?? 0),
  };
}

export { tick as runWorkerOnce };
