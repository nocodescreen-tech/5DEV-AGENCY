-- Documentation d'intégration par plateforme.
-- Une plateforme = une fiche (pas une par tarif) : les commandes et le lien de
-- doc ne changent pas selon le plan choisi.
create table if not exists market_platform_docs (
  provider text primary key,
  doc_url text not null default '',
  sdk_node text,
  sdk_python text,
  snippet_node text,
  snippet_python text,
  api_style text not null default 'REST',
  note text not null default '',
  updated_at timestamptz not null default now()
);

create index if not exists market_docs_provider_idx on market_platform_docs (lower(provider));
