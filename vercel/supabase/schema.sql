create extension if not exists pgcrypto;

create table if not exists public.playlists (
  slug text primary key,
  name text not null,
  channel_count integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.channels (
  id bigint generated always as identity primary key,
  name text not null,
  category text not null default '',
  logo_url text not null default '',
  stream_url text not null unique,
  status text not null default 'LIVE',
  updated_at timestamptz not null default now()
);

create table if not exists public.playlist_channels (
  playlist_slug text not null references public.playlists(slug) on delete cascade,
  channel_id bigint not null references public.channels(id) on delete cascade,
  position integer not null default 0,
  primary key (playlist_slug, channel_id)
);

create table if not exists public.playlist_tokens (
  token text primary key,
  playlist_slug text not null unique references public.playlists(slug) on delete cascade,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.playlist_groups (
  playlist_slug text not null references public.playlists(slug) on delete cascade,
  name text not null,
  position integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (playlist_slug, name)
);

create table if not exists public.admin_users (
  user_id uuid primary key,
  email text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.job_runs (
  job_name text primary key,
  last_run_at timestamptz not null default now(),
  is_enabled boolean not null default true,
  last_status text not null default 'ok',
  last_message text not null default '',
  last_total integer not null default 0,
  last_live integer not null default 0,
  last_dead integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.job_runs add column if not exists is_enabled boolean not null default true;


alter table public.channels add column if not exists include_on_home boolean not null default true;

create table if not exists public.client_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null default '',
  mobile_number text not null default '',
  mobile_login_key text,
  is_active boolean not null default true,
  created_by_admin uuid null references public.admin_users(user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.client_users add column if not exists mobile_number text not null default '';
alter table public.client_users add column if not exists mobile_login_key text;
update public.client_users
set mobile_login_key = right(regexp_replace(mobile_number, '\D', '', 'g'), 11)
where mobile_login_key is null
  and length(regexp_replace(mobile_number, '\D', '', 'g')) >= 11;

create table if not exists public.client_state (
  user_id uuid primary key references public.client_users(user_id) on delete cascade,
  favorites jsonb not null default '[]'::jsonb,
  recent jsonb not null default '[]'::jsonb,
  last_channel_id text not null default '',
  theme text not null default 'dark',
  cookie_prefs jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.client_recent_history (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.client_users(user_id) on delete cascade,
  channel_id text not null default '',
  channel_name text not null default '',
  watched_at timestamptz not null default now(),
  watch_seconds integer not null default 0,
  source text not null default 'home'
);

create table if not exists public.client_favorites (
  user_id uuid not null references public.client_users(user_id) on delete cascade,
  channel_id text not null,
  channel_name text not null default '',
  created_at timestamptz not null default now(),
  primary key (user_id, channel_id)
);

create table if not exists public.client_activity_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.client_users(user_id) on delete cascade,
  event_type text not null,
  event_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists channels_category_name_idx on public.channels(category, name);
create index if not exists playlist_channels_slug_idx on public.playlist_channels(playlist_slug);
create index if not exists playlist_tokens_slug_idx on public.playlist_tokens(playlist_slug);
create index if not exists playlist_groups_slug_pos_idx on public.playlist_groups(playlist_slug, position);
create index if not exists client_users_email_idx on public.client_users(email);
create unique index if not exists client_users_mobile_login_key_uidx
on public.client_users(mobile_login_key)
where mobile_login_key is not null;
create index if not exists client_recent_history_user_time_idx on public.client_recent_history(user_id, watched_at desc);
create index if not exists client_activity_events_user_time_idx on public.client_activity_events(user_id, created_at desc);

alter table public.playlists enable row level security;
alter table public.channels enable row level security;
alter table public.playlist_channels enable row level security;
alter table public.playlist_tokens enable row level security;
alter table public.playlist_groups enable row level security;
alter table public.admin_users enable row level security;
alter table public.job_runs enable row level security;
alter table public.client_users enable row level security;
alter table public.client_state enable row level security;
alter table public.client_recent_history enable row level security;
alter table public.client_favorites enable row level security;
alter table public.client_activity_events enable row level security;

drop policy if exists deny_all_playlists on public.playlists;
create policy deny_all_playlists on public.playlists for all using (false) with check (false);
drop policy if exists deny_all_channels on public.channels;
create policy deny_all_channels on public.channels for all using (false) with check (false);
drop policy if exists deny_all_playlist_channels on public.playlist_channels;
create policy deny_all_playlist_channels on public.playlist_channels for all using (false) with check (false);
drop policy if exists deny_all_playlist_tokens on public.playlist_tokens;
create policy deny_all_playlist_tokens on public.playlist_tokens for all using (false) with check (false);
drop policy if exists deny_all_playlist_groups on public.playlist_groups;
create policy deny_all_playlist_groups on public.playlist_groups for all using (false) with check (false);
drop policy if exists deny_all_admin_users on public.admin_users;
create policy deny_all_admin_users on public.admin_users for all using (false) with check (false);
drop policy if exists deny_all_job_runs on public.job_runs;
create policy deny_all_job_runs on public.job_runs for all using (false) with check (false);
drop policy if exists deny_all_client_users on public.client_users;
create policy deny_all_client_users on public.client_users for all using (false) with check (false);
drop policy if exists deny_all_client_state on public.client_state;
create policy deny_all_client_state on public.client_state for all using (false) with check (false);
drop policy if exists deny_all_client_recent_history on public.client_recent_history;
create policy deny_all_client_recent_history on public.client_recent_history for all using (false) with check (false);
drop policy if exists deny_all_client_favorites on public.client_favorites;
create policy deny_all_client_favorites on public.client_favorites for all using (false) with check (false);
drop policy if exists deny_all_client_activity_events on public.client_activity_events;
create policy deny_all_client_activity_events on public.client_activity_events for all using (false) with check (false);
