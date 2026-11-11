-- Gestionnaire de comptes des autres applications (5DEV).
-- Le mot de passe n'est jamais stocké en clair : `password_enc` contient la valeur
-- produite par `encryptSecret` (AES-256-GCM, clé dérivée de SESSION_SECRET).
-- Idempotent : rejouable sans perte de données.

create table if not exists app_credentials (
  id uuid primary key default gen_random_uuid(),
  app_name text not null,
  category text not null default 'autre',
  username text,
  password_enc text not null,
  url text,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_revealed_at timestamptz
);

create index if not exists app_credentials_name_idx on app_credentials (lower(app_name));
create index if not exists app_credentials_category_idx on app_credentials (category);

-- Un même compte (application + identifiant) ne doit pas exister deux fois :
-- sinon on ne sait plus lequel est le bon au moment de se connecter.
create unique index if not exists app_credentials_unique_idx
  on app_credentials (lower(app_name), lower(coalesce(username, '')));
