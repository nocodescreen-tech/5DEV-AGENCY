-- Profil utilisateur : avatar + préférences d'affichage (idempotent)
alter table users add column if not exists avatar_url text;
alter table users add column if not exists display_name text;
alter table users add column if not exists job_title text;
alter table users add column if not exists phone text;
alter table users add column if not exists last_login_at timestamptz;
