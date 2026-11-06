-- 5DEV — schéma V1 (idempotent, rejouable)
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- comptes
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  full_name text not null default 'Administrateur',
  role text not null default 'owner' check (role in ('owner','admin','editor')),
  is_active boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  ip text,
  user_agent text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists sessions_user_idx on sessions(user_id);

create table if not exists settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- catalogue
create table if not exists service_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  tagline text,
  description text,
  position int not null default 0,
  is_published boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists services (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references service_categories(id) on delete set null,
  slug text not null unique,
  title text not null,
  summary text not null default '',
  description text not null default '',
  deliverables text[] not null default '{}',
  price_from_usd numeric(12,2),
  price_from_cdf numeric(14,2),
  price_note text,
  duration_label text,
  position int not null default 0,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists services_category_idx on services(category_id, position);

-- ---------------------------------------------------------------- réalisations
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  client_name text,
  year int,
  category_id uuid references service_categories(id) on delete set null,
  summary text not null default '',
  body text not null default '',
  cover_url text,
  live_url text,
  is_published boolean not null default false,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- demandes
create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'quote' check (kind in ('quote','contact')),
  status text not null default 'new' check (status in ('new','in_progress','quoted','won','lost')),
  contact_name text not null,
  contact_email text not null,
  contact_phone text,
  service_id uuid references services(id) on delete set null,
  budget_amount numeric(14,2),
  budget_currency text not null default 'USD' check (budget_currency in ('USD','CDF')),
  message text not null default '',
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists leads_status_idx on leads(status, created_at desc);

create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  service_id uuid references services(id) on delete set null,
  full_name text not null,
  email text not null,
  phone text,
  shoot_date date not null,
  slot text not null check (slot in ('morning','afternoon','evening')),
  location text,
  notes text,
  status text not null default 'pending' check (status in ('pending','confirmed','done','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists bookings_slot_uidx
  on bookings(shoot_date, slot) where status in ('pending','confirmed');

-- ---------------------------------------------------------------- audit
create table if not exists audit_logs (
  id bigserial primary key,
  actor_type text not null default 'user',
  actor_id uuid,
  action text not null,
  target_type text,
  target_id text,
  ip text,
  meta jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists audit_created_idx on audit_logs(created_at desc);
