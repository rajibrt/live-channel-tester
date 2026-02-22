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

create index if not exists channels_category_name_idx on public.channels(category, name);
create index if not exists playlist_channels_slug_idx on public.playlist_channels(playlist_slug);
create index if not exists playlist_tokens_slug_idx on public.playlist_tokens(playlist_slug);
create index if not exists playlist_groups_slug_pos_idx on public.playlist_groups(playlist_slug, position);

alter table public.playlists enable row level security;
alter table public.channels enable row level security;
alter table public.playlist_channels enable row level security;
alter table public.playlist_tokens enable row level security;
alter table public.playlist_groups enable row level security;
alter table public.admin_users enable row level security;
alter table public.job_runs enable row level security;

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
