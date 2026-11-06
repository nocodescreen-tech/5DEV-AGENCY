-- 5DEV AI CHAT + gestionnaire de modèles NVIDIA (idempotent)

-- 5 emplacements de modèles, remplis par le catalogue réel une fois la clé posée.
create table if not exists ai_models (
  id uuid primary key default gen_random_uuid(),
  slot text not null unique check (slot in ('general','reasoning','code','fast','multimodal')),
  label text not null,
  model_id text,
  provider text not null default 'nvidia',
  capabilities text[] not null default '{}',
  context_window int,
  status text not null default 'unverified' check (status in ('verified','unverified','unavailable','disabled')),
  is_default boolean not null default false,
  is_active boolean not null default true,
  notes text,
  last_checked_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);

insert into ai_models(slot,label,capabilities,is_default) values
  ('general','Généraliste', array['chat','redaction'], true),
  ('reasoning','Raisonnement', array['analyse'], false),
  ('code','Programmation', array['code'], false),
  ('fast','Rapide', array['chat'], false),
  ('multimodal','Multimodal', array['vision'], false)
on conflict (slot) do nothing;

create table if not exists ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  title text not null default 'Nouvelle conversation',
  model_id text,
  system_prompt text,
  temperature numeric(3,2) not null default 0.60 check (temperature >= 0 and temperature <= 1.5),
  max_tokens int not null default 900 check (max_tokens between 64 and 4096),
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ai_conv_user_idx on ai_conversations(user_id, updated_at desc);

create table if not exists ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references ai_conversations(id) on delete cascade,
  role text not null check (role in ('user','assistant','system')),
  content text not null,
  model text,
  provider text,
  stubbed boolean not null default false,
  latency_ms int,
  error text,
  created_at timestamptz not null default now()
);
create index if not exists ai_msg_conv_idx on ai_messages(conversation_id, created_at);

-- Clé fournisseur chiffrée au repos (AES-256-GCM), jamais renvoyée en clair.
create table if not exists secrets (
  name text primary key,
  ciphertext text not null,
  iv text not null,
  tag text not null,
  hint text,
  updated_at timestamptz not null default now()
);
