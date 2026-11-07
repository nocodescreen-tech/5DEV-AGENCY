-- Suivi de lecture des messages de l'assistant (badge de non-lus)
alter table ai_messages add column if not exists read_at timestamptz;
create index if not exists idx_ai_messages_unread on ai_messages(conversation_id) where read_at is null;
