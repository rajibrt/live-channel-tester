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
  approval_status text not null default 'approved',
  approved_at timestamptz null,
  approved_by_admin uuid null references public.admin_users(user_id) on delete set null,
  approval_note text not null default '',
  auth_provider text not null default 'password',
  provider_user_id text not null default '',
  avatar_url text not null default '',
  oauth_profile_json jsonb not null default '{}'::jsonb,
  lifetime_watch_count bigint not null default 0,
  lifetime_watch_seconds bigint not null default 0,
  last_watched_at timestamptz null,
  is_active boolean not null default true,
  created_by_admin uuid null references public.admin_users(user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.client_users add column if not exists mobile_number text not null default '';
alter table public.client_users add column if not exists mobile_login_key text;
alter table public.client_users add column if not exists approval_status text not null default 'approved';
alter table public.client_users add column if not exists approved_at timestamptz null;
alter table public.client_users add column if not exists approved_by_admin uuid null references public.admin_users(user_id) on delete set null;
alter table public.client_users add column if not exists approval_note text not null default '';
alter table public.client_users add column if not exists auth_provider text not null default 'password';
alter table public.client_users add column if not exists provider_user_id text not null default '';
alter table public.client_users add column if not exists avatar_url text not null default '';
alter table public.client_users add column if not exists oauth_profile_json jsonb not null default '{}'::jsonb;
alter table public.client_users add column if not exists lifetime_watch_count bigint not null default 0;
alter table public.client_users add column if not exists lifetime_watch_seconds bigint not null default 0;
alter table public.client_users add column if not exists last_watched_at timestamptz null;
update public.client_users
set approval_status = case
  when coalesce(is_active, true) then 'approved'
  else 'rejected'
end
where coalesce(approval_status, '') not in ('pending', 'approved', 'rejected');
update public.client_users
set mobile_login_key = right(regexp_replace(mobile_number, '\D', '', 'g'), 11)
where mobile_login_key is null
  and length(regexp_replace(mobile_number, '\D', '', 'g')) >= 11;

create or replace function public.increment_client_watch_totals(
  p_user_id uuid,
  p_watch_seconds integer,
  p_watched_at timestamptz default now()
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null then
    return;
  end if;

  if coalesce(p_watch_seconds, 0) <= 0 then
    return;
  end if;

  update public.client_users
  set
    lifetime_watch_count = coalesce(lifetime_watch_count, 0) + 1,
    lifetime_watch_seconds = coalesce(lifetime_watch_seconds, 0) + greatest(p_watch_seconds, 0),
    last_watched_at = case
      when last_watched_at is null then p_watched_at
      else greatest(last_watched_at, p_watched_at)
    end,
    updated_at = now()
  where user_id = p_user_id;
end;
$$;

create table if not exists public.admin_notifications (
  id uuid primary key default gen_random_uuid(),
  type text not null default 'system',
  title text not null,
  message text not null default '',
  payload_json jsonb not null default '{}'::jsonb,
  target_admin_id uuid null references public.admin_users(user_id) on delete cascade,
  is_read boolean not null default false,
  read_at timestamptz null,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_push_subscriptions (
  id bigint generated always as identity primary key,
  admin_user_id uuid not null references public.admin_users(user_id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.client_push_subscriptions (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.client_users(user_id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

with lifetime as (
  select
    user_id,
    count(*) filter (where source <> 'sync')::bigint as total_count,
    coalesce(sum(greatest(watch_seconds, 0)) filter (where source <> 'sync'), 0)::bigint as total_seconds,
    max(watched_at) filter (where source <> 'sync') as last_watch_at
  from public.client_recent_history
  group by user_id
)
update public.client_users cu
set
  lifetime_watch_count = greatest(coalesce(cu.lifetime_watch_count, 0), coalesce(l.total_count, 0)),
  lifetime_watch_seconds = greatest(coalesce(cu.lifetime_watch_seconds, 0), coalesce(l.total_seconds, 0)),
  last_watched_at = case
    when cu.last_watched_at is null then l.last_watch_at
    when l.last_watch_at is null then cu.last_watched_at
    else greatest(cu.last_watched_at, l.last_watch_at)
  end,
  updated_at = now()
from lifetime l
where cu.user_id = l.user_id;

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

create table if not exists public.admin_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content_html text not null,
  is_published boolean not null default false,
  is_pinned boolean not null default false,
  position integer not null default 0,
  show_title_in_ticker boolean not null default false,
  ticker_speed_seconds integer not null default 34,
  published_at timestamptz null,
  created_by_admin uuid null references auth.users(id) on delete set null,
  updated_by_admin uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.admin_announcements
add column if not exists ticker_speed_seconds integer not null default 34;

alter table public.admin_announcements
add column if not exists show_title_in_ticker boolean not null default false;

alter table public.admin_announcements
add column if not exists position integer not null default 0;

create table if not exists public.client_notification_reads (
  user_id uuid not null references public.client_users(user_id) on delete cascade,
  announcement_id uuid not null references public.admin_announcements(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (user_id, announcement_id)
);

with ordered as (
  select id, row_number() over (order by created_at asc, id asc) as rn
  from public.admin_announcements
)
update public.admin_announcements a
set position = ordered.rn
from ordered
where a.id = ordered.id
  and coalesce(a.position, 0) <= 0;

create table if not exists public.admin_settings (
  key text primary key,
  value_json jsonb not null default '{}'::jsonb,
  updated_by_admin uuid null references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.admin_settings (key, value_json)
values ('announcement_ticker', '{"speed_seconds":34,"icon_text":"•"}'::jsonb)
on conflict (key) do nothing;

create index if not exists channels_category_name_idx on public.channels(category, name);
create index if not exists playlist_channels_slug_idx on public.playlist_channels(playlist_slug);
create index if not exists playlist_tokens_slug_idx on public.playlist_tokens(playlist_slug);
create index if not exists playlist_groups_slug_pos_idx on public.playlist_groups(playlist_slug, position);
create index if not exists client_users_email_idx on public.client_users(email);
create unique index if not exists client_users_mobile_login_key_uidx
on public.client_users(mobile_login_key)
where mobile_login_key is not null;
create index if not exists client_users_approval_status_idx on public.client_users(approval_status);
create index if not exists client_users_provider_user_id_idx on public.client_users(provider_user_id);
create index if not exists client_users_last_watched_at_idx on public.client_users(last_watched_at desc);
create index if not exists client_recent_history_user_time_idx on public.client_recent_history(user_id, watched_at desc);
create index if not exists client_activity_events_user_time_idx on public.client_activity_events(user_id, created_at desc);
create index if not exists client_activity_events_type_time_idx on public.client_activity_events(event_type, created_at desc);
create index if not exists client_activity_events_playback_channel_idx
on public.client_activity_events((event_data->>'channel_id'), created_at desc)
where event_type in ('playback_attempt', 'playback_failed');
create index if not exists client_notification_reads_user_time_idx on public.client_notification_reads(user_id, read_at desc);
create index if not exists admin_announcements_created_idx on public.admin_announcements(created_at desc);
create index if not exists admin_announcements_published_idx on public.admin_announcements(is_published, created_at desc);
create index if not exists admin_announcements_pinned_idx on public.admin_announcements(is_pinned, created_at desc);
create index if not exists admin_notifications_created_idx on public.admin_notifications(created_at desc);
create index if not exists admin_notifications_read_idx on public.admin_notifications(is_read, created_at desc);
create index if not exists admin_push_subscriptions_admin_idx on public.admin_push_subscriptions(admin_user_id, is_active);
create index if not exists client_push_subscriptions_user_idx on public.client_push_subscriptions(user_id, is_active);

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
alter table public.client_notification_reads enable row level security;
alter table public.admin_announcements enable row level security;
alter table public.admin_settings enable row level security;
alter table public.admin_notifications enable row level security;
alter table public.admin_push_subscriptions enable row level security;
alter table public.client_push_subscriptions enable row level security;

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
drop policy if exists deny_all_client_notification_reads on public.client_notification_reads;
create policy deny_all_client_notification_reads on public.client_notification_reads for all using (false) with check (false);
drop policy if exists deny_all_admin_announcements on public.admin_announcements;
create policy deny_all_admin_announcements on public.admin_announcements for all using (false) with check (false);
drop policy if exists deny_all_admin_settings on public.admin_settings;
create policy deny_all_admin_settings on public.admin_settings for all using (false) with check (false);
drop policy if exists deny_all_admin_notifications on public.admin_notifications;
create policy deny_all_admin_notifications on public.admin_notifications for all using (false) with check (false);
drop policy if exists deny_all_admin_push_subscriptions on public.admin_push_subscriptions;
create policy deny_all_admin_push_subscriptions on public.admin_push_subscriptions for all using (false) with check (false);
drop policy if exists deny_all_client_push_subscriptions on public.client_push_subscriptions;
create policy deny_all_client_push_subscriptions on public.client_push_subscriptions for all using (false) with check (false);

create table if not exists public.movies (
  id bigint generated always as identity primary key,
  slug text not null unique,
  title text not null,
  synopsis text not null default '',
  poster_url text not null default '',
  backdrop_url text not null default '',
  release_year integer null,
  runtime_seconds integer not null default 0,
  imdb_id text null,
  imdb_url text not null default '',
  imdb_rating numeric(3,1) null,
  imdb_votes integer null,
  content_rating text not null default '',
  imdb_genres text[] not null default '{}',
  imdb_directors text[] not null default '{}',
  imdb_writers text[] not null default '{}',
  imdb_stars text[] not null default '{}',
  imdb_release_date text not null default '',
  imdb_countries text[] not null default '{}',
  imdb_languages text[] not null default '{}',
  video_quality text not null default '',
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.movies add column if not exists imdb_id text null;
alter table public.movies add column if not exists imdb_url text not null default '';
alter table public.movies add column if not exists imdb_rating numeric(3,1) null;
alter table public.movies add column if not exists imdb_votes integer null;
alter table public.movies add column if not exists content_rating text not null default '';
alter table public.movies add column if not exists imdb_genres text[] not null default '{}';
alter table public.movies add column if not exists imdb_directors text[] not null default '{}';
alter table public.movies add column if not exists imdb_writers text[] not null default '{}';
alter table public.movies add column if not exists imdb_stars text[] not null default '{}';
alter table public.movies add column if not exists imdb_release_date text not null default '';
alter table public.movies add column if not exists imdb_countries text[] not null default '{}';
alter table public.movies add column if not exists imdb_languages text[] not null default '{}';
alter table public.movies add column if not exists video_quality text not null default '';

create table if not exists public.movie_categories (
  id bigint generated always as identity primary key,
  slug text not null unique,
  name text not null,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.movie_category_map (
  movie_id bigint not null references public.movies(id) on delete cascade,
  category_id bigint not null references public.movie_categories(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (movie_id, category_id)
);

create table if not exists public.movie_sources (
  id bigint generated always as identity primary key,
  movie_id bigint not null references public.movies(id) on delete cascade,
  label text not null default 'default',
  source_url text not null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.movie_sources add column if not exists label text not null default 'default';
alter table public.movie_sources add column if not exists source_url text not null default '';
alter table public.movie_sources add column if not exists is_active boolean not null default true;
alter table public.movie_sources add column if not exists sort_order integer not null default 0;
alter table public.movie_sources add column if not exists created_at timestamptz not null default now();
alter table public.movie_sources add column if not exists updated_at timestamptz not null default now();

create table if not exists public.movie_watch_progress (
  user_id uuid not null references public.client_users(user_id) on delete cascade,
  movie_id bigint not null references public.movies(id) on delete cascade,
  position_seconds integer not null default 0,
  duration_seconds integer not null default 0,
  progress_percent numeric(5,2) not null default 0,
  is_completed boolean not null default false,
  last_event text not null default 'progress',
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (user_id, movie_id)
);

alter table public.movie_watch_progress add column if not exists position_seconds integer not null default 0;
alter table public.movie_watch_progress add column if not exists duration_seconds integer not null default 0;
alter table public.movie_watch_progress add column if not exists progress_percent numeric(5,2) not null default 0;
alter table public.movie_watch_progress add column if not exists is_completed boolean not null default false;
alter table public.movie_watch_progress add column if not exists last_event text not null default 'progress';
alter table public.movie_watch_progress add column if not exists updated_at timestamptz not null default now();
alter table public.movie_watch_progress add column if not exists created_at timestamptz not null default now();

create table if not exists public.movie_favorites (
  user_id uuid not null references public.client_users(user_id) on delete cascade,
  movie_id bigint not null references public.movies(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, movie_id)
);

alter table public.movie_favorites add column if not exists created_at timestamptz not null default now();

create table if not exists public.movie_recent_history (
  user_id uuid not null references public.client_users(user_id) on delete cascade,
  movie_id bigint not null references public.movies(id) on delete cascade,
  watched_at timestamptz not null default now(),
  position_seconds integer not null default 0,
  source text not null default 'progress',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, movie_id)
);

alter table public.movie_recent_history add column if not exists watched_at timestamptz not null default now();
alter table public.movie_recent_history add column if not exists position_seconds integer not null default 0;
alter table public.movie_recent_history add column if not exists source text not null default 'progress';
alter table public.movie_recent_history add column if not exists created_at timestamptz not null default now();
alter table public.movie_recent_history add column if not exists updated_at timestamptz not null default now();

insert into public.movie_categories (slug, name, position)
values
  ('bangla', 'Bangla', 1),
  ('hindi', 'Hindi', 2),
  ('english', 'English', 3),
  ('love-story', 'Love Story', 4),
  ('family', 'Family', 5)
on conflict (slug) do update
set
  name = excluded.name,
  position = excluded.position,
  updated_at = now();

create index if not exists movies_published_updated_idx
on public.movies(is_published, updated_at desc);
create index if not exists movies_title_idx
on public.movies(title);
create unique index if not exists movies_imdb_id_unique_idx
on public.movies(imdb_id)
where imdb_id is not null;
create index if not exists movie_categories_position_idx
on public.movie_categories(position, name);
create index if not exists movie_category_map_category_movie_idx
on public.movie_category_map(category_id, movie_id);
create index if not exists movie_sources_movie_active_order_idx
on public.movie_sources(movie_id, is_active, sort_order, id);
create index if not exists movie_watch_progress_user_updated_idx
on public.movie_watch_progress(user_id, updated_at desc);
create index if not exists movie_watch_progress_movie_idx
on public.movie_watch_progress(movie_id);
create index if not exists movie_favorites_user_created_idx
on public.movie_favorites(user_id, created_at desc);
create index if not exists movie_recent_history_user_watched_idx
on public.movie_recent_history(user_id, watched_at desc);

alter table public.movies enable row level security;
alter table public.movie_categories enable row level security;
alter table public.movie_category_map enable row level security;
alter table public.movie_sources enable row level security;
alter table public.movie_watch_progress enable row level security;
alter table public.movie_favorites enable row level security;
alter table public.movie_recent_history enable row level security;

drop policy if exists deny_all_movies on public.movies;
create policy deny_all_movies on public.movies for all using (false) with check (false);
drop policy if exists deny_all_movie_categories on public.movie_categories;
create policy deny_all_movie_categories on public.movie_categories for all using (false) with check (false);
drop policy if exists deny_all_movie_category_map on public.movie_category_map;
create policy deny_all_movie_category_map on public.movie_category_map for all using (false) with check (false);
drop policy if exists deny_all_movie_sources on public.movie_sources;
create policy deny_all_movie_sources on public.movie_sources for all using (false) with check (false);
drop policy if exists deny_all_movie_watch_progress on public.movie_watch_progress;
create policy deny_all_movie_watch_progress on public.movie_watch_progress for all using (false) with check (false);
drop policy if exists deny_all_movie_favorites on public.movie_favorites;
create policy deny_all_movie_favorites on public.movie_favorites for all using (false) with check (false);
drop policy if exists deny_all_movie_recent_history on public.movie_recent_history;
create policy deny_all_movie_recent_history on public.movie_recent_history for all using (false) with check (false);
