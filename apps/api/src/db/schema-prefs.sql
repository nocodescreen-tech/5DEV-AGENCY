-- Préférences de notification (idempotent)
alter table user_prefs add column if not exists email_notifications boolean not null default true;
alter table user_prefs add column if not exists push_notifications boolean not null default false;
alter table user_prefs add column if not exists weekly_digest boolean not null default true;
