-- Veille tarifaire : offres des fournisseurs utilisées pour un projet 5DEV.
--
-- `source_kind` dit d'où vient le prix, et c'est ce qui protège l'utilisateur :
--   'api'    -> relevé automatiquement sur une interface publique, `checked_at` récent
--   'manuel' -> prix publié, saisi à la main, non revérifié : affiché comme indicatif
-- Aucune ligne ne doit être présentée comme « temps réel » si `source_kind = 'manuel'`.

create table if not exists market_offers (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  provider text not null,
  plan text not null,
  specs text not null default '',
  price numeric(12,2),
  currency text not null default 'USD',
  unit text not null default '/mois',
  url text not null default '',
  source_kind text not null default 'manuel' check (source_kind in ('api','page','manuel')),
  source_ref text,
  prev_price numeric(12,2),
  checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists market_offers_unique_idx
  on market_offers (category, provider, plan);

create index if not exists market_offers_category_idx on market_offers (category, price);

-- Historique des variations : c'est la preuve qu'un prix a bougé chez le fournisseur.
create table if not exists market_price_history (
  id bigserial primary key,
  offer_id uuid not null references market_offers(id) on delete cascade,
  price numeric(12,2),
  currency text not null default 'USD',
  seen_at timestamptz not null default now()
);
create index if not exists market_history_offer_idx on market_price_history (offer_id, seen_at desc);
