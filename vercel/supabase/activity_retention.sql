-- Activity-log retention for client_activity_events.
-- Run in the Supabase SQL Editor. Safe to re-run.
--
-- STEP 1 (this whole block): creates the archive-totals table, the prune
-- function, runs the first prune (keeps the last 90 days) and schedules a
-- daily prune. Deleted raw rows cannot be recovered; their per-event-type
-- counts are kept in client_activity_event_archive_totals so all-time
-- dashboard totals stay correct.
--
-- STEP 2 (run separately, alone): see the VACUUM FULL line at the bottom.

create table if not exists public.client_activity_event_archive_totals (
  event_type text primary key,
  archived_count bigint not null default 0,
  archived_before timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.client_activity_event_archive_totals enable row level security;
revoke all on public.client_activity_event_archive_totals from anon, authenticated;

create or replace function public.prune_client_activity_events(p_keep_days integer default 90)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cutoff timestamptz := now() - make_interval(days => greatest(p_keep_days, 7));
  v_deleted bigint := 0;
begin
  with del as (
    delete from public.client_activity_events
    where created_at < v_cutoff
    returning event_type
  ),
  agg as (
    select event_type, count(*)::bigint as c from del group by event_type
  ),
  up as (
    insert into public.client_activity_event_archive_totals as t
      (event_type, archived_count, archived_before, updated_at)
    select event_type, c, v_cutoff, now() from agg
    on conflict (event_type) do update
      set archived_count = t.archived_count + excluded.archived_count,
          archived_before = greatest(t.archived_before, excluded.archived_before),
          updated_at = now()
    returning 1
  )
  select coalesce(sum(c), 0) into v_deleted from agg;
  return v_deleted;
end;
$$;

revoke all on function public.prune_client_activity_events(integer) from public;
revoke all on function public.prune_client_activity_events(integer) from anon, authenticated;
grant execute on function public.prune_client_activity_events(integer) to service_role;

-- First prune: keep the last 90 days.
set statement_timeout = '15min';
select public.prune_client_activity_events(90) as deleted_rows;

-- Daily prune at 20:30 UTC (02:30 Asia/Dhaka).
create extension if not exists pg_cron;
select cron.schedule(
  'prune-client-activity-events',
  '30 20 * * *',
  $cron$select public.prune_client_activity_events(90)$cron$
);

notify pgrst, 'reload schema';

-- STEP 2: run this line ALONE afterwards to return the freed space
-- (briefly locks the table while it is rewritten):
-- vacuum full public.client_activity_events;
