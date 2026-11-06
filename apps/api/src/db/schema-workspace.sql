-- 5DEV — WORKSPACE (gestion de projets) — idempotent
create table if not exists project_statuses (
  slug text primary key,
  label text not null,
  position int not null default 0
);
insert into project_statuses(slug,label,position) values
  ('planning','Planification',0),
  ('active','En cours',1),
  ('paused','En pause',2),
  ('blocked','Bloqué',3),
  ('done','Terminé',4),
  ('archived','Archivé',5)
on conflict (slug) do nothing;

create table if not exists project_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  category text,
  stages jsonb not null default '[]',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists projects_pm (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  name text not null,
  description text not null default '',
  category text not null default 'dev-web',
  client_name text,
  owner_id uuid references users(id) on delete set null,
  template_id uuid references project_templates(id) on delete set null,
  status text not null default 'planning' references project_statuses(slug),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  start_date date,
  due_date date,
  budget_amount numeric(14,2),
  budget_currency text not null default 'USD' check (budget_currency in ('USD','CDF')),
  technologies text[] not null default '{}',
  objectives text not null default '',
  deliverables text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists projects_pm_status_idx on projects_pm(status, due_date);
create index if not exists projects_pm_client_idx on projects_pm(lower(client_name));

create table if not exists project_stages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects_pm(id) on delete cascade,
  name text not null,
  description text not null default '',
  position int not null default 0,
  weight int not null default 1 check (weight between 1 and 10),
  status text not null default 'todo' check (status in ('todo','doing','done')),
  validation_criteria text,
  due_date date,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists stages_project_idx on project_stages(project_id, position);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects_pm(id) on delete cascade,
  stage_id uuid references project_stages(id) on delete set null,
  parent_id uuid references tasks(id) on delete cascade,
  title text not null,
  description text not null default '',
  status text not null default 'todo' check (status in ('todo','doing','review','blocked','done')),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  assignee_id uuid references users(id) on delete set null,
  start_date date,
  due_date date,
  estimate_minutes int,
  position int not null default 0,
  checklist jsonb not null default '[]',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists tasks_project_idx on tasks(project_id, status, position);
create index if not exists tasks_due_idx on tasks(due_date) where deleted_at is null;

create table if not exists task_dependencies (
  task_id uuid not null references tasks(id) on delete cascade,
  depends_on_id uuid not null references tasks(id) on delete cascade,
  primary key (task_id, depends_on_id),
  check (task_id <> depends_on_id)
);

create table if not exists task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  author_id uuid references users(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists time_entries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects_pm(id) on delete cascade,
  task_id uuid references tasks(id) on delete set null,
  actor_id uuid references users(id) on delete set null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  minutes int,
  note text,
  billable boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists time_project_idx on time_entries(project_id, started_at desc);
create unique index if not exists time_running_uidx on time_entries(actor_id) where ended_at is null;

create table if not exists project_documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects_pm(id) on delete cascade,
  name text not null,
  url text not null,
  kind text not null default 'link' check (kind in ('link','file','spec','design','delivery')),
  is_shared boolean not null default false,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists project_notes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects_pm(id) on delete cascade,
  kind text not null default 'note' check (kind in ('note','journal','decision','meeting','issue')),
  title text not null,
  body text not null default '',
  author_id uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists project_activities (
  id bigserial primary key,
  project_id uuid not null references projects_pm(id) on delete cascade,
  kind text not null,
  label text not null,
  meta jsonb not null default '{}',
  actor_id uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists project_activities_idx on project_activities(project_id, created_at desc);
