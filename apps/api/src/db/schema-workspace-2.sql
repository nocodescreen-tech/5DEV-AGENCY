-- Workspace : jalons, affectation, pièces jointes de tâche, rappels (idempotent)

create table if not exists milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects_pm(id) on delete cascade,
  name text not null,
  description text not null default '',
  due_date date,
  status text not null default 'pending' check (status in ('pending','reached','missed')),
  reached_at timestamptz,
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists milestones_project_idx on milestones(project_id, due_date);

-- pièces jointes de tâche : mêmes règles que les documents projet (liens, partageable)
alter table project_documents add column if not exists task_id uuid references tasks(id) on delete cascade;
create index if not exists project_documents_task_idx on project_documents(task_id);

-- rappels : une notification par (tâche, jour) pour éviter les doublons
create table if not exists reminder_log (
  id bigserial primary key,
  dedupe_key text not null unique,
  kind text not null,
  target_id uuid,
  created_at timestamptz not null default now()
);

-- sous-tâches : l'interface affiche désormais la hiérarchie
create index if not exists tasks_parent_idx on tasks(parent_id) where deleted_at is null;
