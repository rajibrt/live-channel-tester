-- Supabase Security Advisor fix:
-- Applies RLS + a deny-all policy for core public tables used by this app.
-- Safe to run multiple times.

do $$
begin
  if to_regclass('public.playlists') is not null then
    execute 'alter table public.playlists enable row level security';
    execute 'drop policy if exists deny_all_playlists on public.playlists';
    execute 'create policy deny_all_playlists on public.playlists for all using (false) with check (false)';
  end if;

  if to_regclass('public.channels') is not null then
    execute 'alter table public.channels enable row level security';
    execute 'drop policy if exists deny_all_channels on public.channels';
    execute 'create policy deny_all_channels on public.channels for all using (false) with check (false)';
  end if;

  if to_regclass('public.playlist_channels') is not null then
    execute 'alter table public.playlist_channels enable row level security';
    execute 'drop policy if exists deny_all_playlist_channels on public.playlist_channels';
    execute 'create policy deny_all_playlist_channels on public.playlist_channels for all using (false) with check (false)';
  end if;

  if to_regclass('public.playlist_tokens') is not null then
    execute 'alter table public.playlist_tokens enable row level security';
    execute 'drop policy if exists deny_all_playlist_tokens on public.playlist_tokens';
    execute 'create policy deny_all_playlist_tokens on public.playlist_tokens for all using (false) with check (false)';
  end if;

  if to_regclass('public.playlist_groups') is not null then
    execute 'alter table public.playlist_groups enable row level security';
    execute 'drop policy if exists deny_all_playlist_groups on public.playlist_groups';
    execute 'create policy deny_all_playlist_groups on public.playlist_groups for all using (false) with check (false)';
  end if;

  if to_regclass('public.admin_users') is not null then
    execute 'alter table public.admin_users enable row level security';
    execute 'drop policy if exists deny_all_admin_users on public.admin_users';
    execute 'create policy deny_all_admin_users on public.admin_users for all using (false) with check (false)';
  end if;

  if to_regclass('public.job_runs') is not null then
    execute 'alter table public.job_runs enable row level security';
    execute 'drop policy if exists deny_all_job_runs on public.job_runs';
    execute 'create policy deny_all_job_runs on public.job_runs for all using (false) with check (false)';
  end if;

  if to_regclass('public.client_users') is not null then
    execute 'alter table public.client_users enable row level security';
    execute 'drop policy if exists deny_all_client_users on public.client_users';
    execute 'create policy deny_all_client_users on public.client_users for all using (false) with check (false)';
  end if;

  if to_regclass('public.client_state') is not null then
    execute 'alter table public.client_state enable row level security';
    execute 'drop policy if exists deny_all_client_state on public.client_state';
    execute 'create policy deny_all_client_state on public.client_state for all using (false) with check (false)';
  end if;

  if to_regclass('public.client_recent_history') is not null then
    execute 'alter table public.client_recent_history enable row level security';
    execute 'drop policy if exists deny_all_client_recent_history on public.client_recent_history';
    execute 'create policy deny_all_client_recent_history on public.client_recent_history for all using (false) with check (false)';
  end if;

  if to_regclass('public.client_favorites') is not null then
    execute 'alter table public.client_favorites enable row level security';
    execute 'drop policy if exists deny_all_client_favorites on public.client_favorites';
    execute 'create policy deny_all_client_favorites on public.client_favorites for all using (false) with check (false)';
  end if;

  if to_regclass('public.client_activity_events') is not null then
    execute 'alter table public.client_activity_events enable row level security';
    execute 'drop policy if exists deny_all_client_activity_events on public.client_activity_events';
    execute 'create policy deny_all_client_activity_events on public.client_activity_events for all using (false) with check (false)';
  end if;

  if to_regclass('public.movies') is not null then
    execute 'alter table public.movies enable row level security';
    execute 'drop policy if exists deny_all_movies on public.movies';
    execute 'create policy deny_all_movies on public.movies for all using (false) with check (false)';
  end if;

  if to_regclass('public.movie_categories') is not null then
    execute 'alter table public.movie_categories enable row level security';
    execute 'drop policy if exists deny_all_movie_categories on public.movie_categories';
    execute 'create policy deny_all_movie_categories on public.movie_categories for all using (false) with check (false)';
  end if;

  if to_regclass('public.movie_category_map') is not null then
    execute 'alter table public.movie_category_map enable row level security';
    execute 'drop policy if exists deny_all_movie_category_map on public.movie_category_map';
    execute 'create policy deny_all_movie_category_map on public.movie_category_map for all using (false) with check (false)';
  end if;

  if to_regclass('public.movie_sources') is not null then
    execute 'alter table public.movie_sources enable row level security';
    execute 'drop policy if exists deny_all_movie_sources on public.movie_sources';
    execute 'create policy deny_all_movie_sources on public.movie_sources for all using (false) with check (false)';
  end if;

  if to_regclass('public.movie_watch_progress') is not null then
    execute 'alter table public.movie_watch_progress enable row level security';
    execute 'drop policy if exists deny_all_movie_watch_progress on public.movie_watch_progress';
    execute 'create policy deny_all_movie_watch_progress on public.movie_watch_progress for all using (false) with check (false)';
  end if;

  if to_regclass('public.movie_favorites') is not null then
    execute 'alter table public.movie_favorites enable row level security';
    execute 'drop policy if exists deny_all_movie_favorites on public.movie_favorites';
    execute 'create policy deny_all_movie_favorites on public.movie_favorites for all using (false) with check (false)';
  end if;

  if to_regclass('public.movie_recent_history') is not null then
    execute 'alter table public.movie_recent_history enable row level security';
    execute 'drop policy if exists deny_all_movie_recent_history on public.movie_recent_history';
    execute 'create policy deny_all_movie_recent_history on public.movie_recent_history for all using (false) with check (false)';
  end if;
end
$$;

-- Verify current state
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where c.relkind = 'r'
  and n.nspname = 'public'
  and c.relname in (
    'playlists',
    'channels',
    'playlist_channels',
    'playlist_tokens',
    'playlist_groups',
    'admin_users',
    'job_runs',
    'client_users',
    'client_state',
    'client_recent_history',
    'client_favorites',
    'client_activity_events',
    'movies',
    'movie_categories',
    'movie_category_map',
    'movie_sources',
    'movie_watch_progress',
    'movie_favorites',
    'movie_recent_history'
  )
order by c.relname;
