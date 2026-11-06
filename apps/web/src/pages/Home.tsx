import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, CheckCircle2, AlertTriangle, CircleDashed } from 'lucide-react';
import { motion } from 'motion/react';
import { APP, POLES, formatUptime } from '@5dev/shared';
import { databaseLabel, fetchHealth } from '../lib/api';

function HealthBadge() {
  const { data, isPending, isError } = useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
    refetchInterval: 30_000,
    retry: 1,
  });

  if (isPending) {
    return (
      <p className="flex items-center gap-2 text-sm text-neutral-400">
        <CircleDashed className="size-4 animate-spin" aria-hidden />
        Interrogation de l’API…
      </p>
    );
  }

  if (isError) {
    return (
      <p className="flex items-center gap-2 text-sm text-amber-300">
        <AlertTriangle className="size-4" aria-hidden />
        API injoignable — lancez <code className="rounded bg-white/10 px-1">npm run dev:api</code>
      </p>
    );
  }

  const dbOk = data.database === 'up';
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-neutral-400">
      <span className="flex items-center gap-2 text-emerald-300">
        <CheckCircle2 className="size-4" aria-hidden />
        API v{data.version}
      </span>
      <span aria-hidden>·</span>
      <span className={dbOk ? 'text-emerald-300' : 'text-neutral-400'}>
        {databaseLabel(data.database)}
      </span>
      <span aria-hidden>·</span>
      <span>en ligne depuis {formatUptime(data.uptimeSeconds)}</span>
    </p>
  );
}

export default function Home() {
  return (
    <main className="min-h-dvh bg-[#050505] px-6 py-10 sm:px-10">
      <div className="mx-auto flex min-h-[calc(100dvh-5rem)] w-full max-w-6xl flex-col justify-between">
        <header className="flex items-center justify-between border-b border-neutral-800 pb-6">
          <span className="text-2xl font-black tracking-tight">
            5<span className="text-[#00cfc8]">DEV</span>
          </span>
          <span className="font-mono text-xs uppercase tracking-[0.25em] text-neutral-500">
            lot 1 · squelette
          </span>
        </header>

        <section className="py-16">
          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-3xl text-5xl font-black leading-[0.95] tracking-tight sm:text-7xl"
          >
            Build.
            <br />
            Innovate.
            <br />
            <span className="text-[#00cfc8]">Grow.</span>
          </motion.h1>

          <p className="mt-8 max-w-xl text-lg text-neutral-400">
            Plateforme officielle de {APP.name} — développement web, solutions digitales,
            croissance digitale et photographie créative.
          </p>

          <ul className="mt-10 grid gap-3 sm:grid-cols-2">
            {POLES.map((pole, i) => (
              <motion.li
                key={pole.slug}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.06, duration: 0.5 }}
                className="flex items-center justify-between rounded-lg border border-neutral-800 px-4 py-3"
              >
                <span className="text-sm">{pole.label}</span>
                <ArrowUpRight className="size-4 text-neutral-600" aria-hidden />
              </motion.li>
            ))}
          </ul>
        </section>

        <footer className="border-t border-neutral-800 pt-6">
          <HealthBadge />
          <p className="mt-3 text-xs text-neutral-600">
            {APP.domain} · {APP.whatsapp} · {APP.email}
          </p>
        </footer>
      </div>
    </main>
  );
}
