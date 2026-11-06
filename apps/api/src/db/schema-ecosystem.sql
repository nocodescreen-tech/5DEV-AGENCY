-- 5DEV — extension « écosystème intelligent » (idempotent)
-- À exécuter après schema.sql (le script setup.mjs applique les deux).

-- ---------------------------------------------------------------- préférences
create table if not exists user_prefs (
  user_id uuid primary key references users(id) on delete cascade,
  theme text not null default 'system' check (theme in ('light','dark','system')),
  accent text not null default 'orange',
  density text not null default 'comfortable' check (density in ('comfortable','compact')),
  sidebar_collapsed boolean not null default false,
  widgets jsonb not null default '[]',
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- notifications
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  kind text not null default 'info',
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on notifications(user_id, created_at desc);

-- ---------------------------------------------------------------- file de tâches
create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  payload jsonb not null default '{}',
  status text not null default 'pending' check (status in ('pending','running','done','failed')),
  attempts int not null default 0,
  max_attempts int not null default 3,
  run_at timestamptz not null default now(),
  locked_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists jobs_ready_idx on jobs(status, run_at);

-- ---------------------------------------------------------------- IA
create table if not exists ai_prompts (
  key text primary key,
  template text not null,
  description text,
  updated_at timestamptz not null default now()
);

create table if not exists ai_usage (
  id bigserial primary key,
  task text not null,
  provider text not null,
  model text not null,
  prompt_tokens int,
  completion_tokens int,
  latency_ms int,
  ok boolean not null,
  error text,
  actor_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists ai_usage_created_idx on ai_usage(created_at desc);

-- ---------------------------------------------------------------- emails sortants
create table if not exists email_outbox (
  id uuid primary key default gen_random_uuid(),
  to_email text not null,
  subject text not null,
  html text not null,
  text_body text,
  status text not null default 'queued' check (status in ('queued','sent','failed')),
  provider text,
  provider_id text,
  error text,
  attempts int not null default 0,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists email_outbox_status_idx on email_outbox(status, created_at desc);

-- ---------------------------------------------------------------- newsletter
create table if not exists subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text,
  status text not null default 'pending' check (status in ('pending','confirmed','unsubscribed','bounced')),
  token text not null unique,
  source text,
  segments text[] not null default '{}',
  consented_at timestamptz,
  confirmed_at timestamptz,
  unsubscribed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  subject text not null,
  html text not null,
  status text not null default 'draft' check (status in ('draft','scheduled','sending','sent','failed')),
  segment text,
  scheduled_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists campaign_sends (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  subscriber_id uuid not null references subscribers(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','sent','failed')),
  provider_id text,
  error text,
  sent_at timestamptz,
  unique (campaign_id, subscriber_id)
);

-- ---------------------------------------------------------------- automatisations
create table if not exists automations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  trigger text not null,
  conditions jsonb not null default '[]',
  actions jsonb not null default '[]',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists automation_runs (
  id uuid primary key default gen_random_uuid(),
  automation_id uuid not null references automations(id) on delete cascade,
  trigger text not null,
  payload jsonb not null default '{}',
  status text not null default 'running' check (status in ('running','done','failed','skipped')),
  steps jsonb not null default '[]',
  error text,
  duration_ms int,
  created_at timestamptz not null default now()
);
create index if not exists automation_runs_idx on automation_runs(created_at desc);
