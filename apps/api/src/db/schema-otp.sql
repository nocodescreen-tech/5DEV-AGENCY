-- Double authentification (TOTP) : obligatoire après le mot de passe (idempotent)

alter table users add column if not exists totp_secret text;
alter table users add column if not exists totp_enabled boolean not null default false;
alter table users add column if not exists totp_confirmed_at timestamptz;

-- un défi par tentative de connexion : courte durée de vie, compteur d'essais
create table if not exists login_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  kind text not null check (kind in ('enroll','verify')),
  secret_enc text,
  attempts int not null default 0,
  ip text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz
);
create index if not exists login_challenges_expiry_idx on login_challenges(expires_at);

-- journal des connexions à deux facteurs (utile en cas d'incident)
create table if not exists otp_events (
  id bigserial primary key,
  user_id uuid references users(id) on delete set null,
  kind text not null,
  ok boolean not null,
  ip text,
  created_at timestamptz not null default now()
);
