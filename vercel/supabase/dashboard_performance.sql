-- Dashboard performance: run once in the Supabase SQL Editor.
-- Safe to re-run.

-- 1) Time-range index. The dashboard filters client_activity_events by
--    created_at alone (7-day, 24-hour and trend windows); without this index
--    those queries scan the whole table and hit the statement timeout.
create index if not exists client_activity_events_time_idx
  on public.client_activity_events (created_at desc);

create index if not exists client_recent_history_time_idx
  on public.client_recent_history (watched_at desc);

-- 2) Unique-visitor trend buckets computed inside Postgres, so the dashboard
--    no longer downloads hundreds of thousands of raw rows.
--    p_unit: 'hour' | 'day' | 'month'
--    p_tz:   IANA time zone used for bucket boundaries (the app server's zone)
create or replace function public.dashboard_unique_visitors(
  p_since timestamptz,
  p_unit text,
  p_tz text default 'UTC',
  p_event_types text[] default array[
    'page_view', 'presence_ping', 'channel_select',
    'playback_attempt', 'movie_playback_attempt', 'client_login'
  ]
)
returns table (bucket timestamptz, visitors bigint)
language sql
stable
security definer
set search_path = public
as $$
  with src as (
    select e.user_id::text as uid, e.created_at as at
    from public.client_activity_events e
    where e.created_at >= p_since
      and e.event_type = any (p_event_types)
      and e.user_id is not null
    union all
    select h.user_id::text as uid, h.watched_at as at
    from public.client_recent_history h
    where h.watched_at >= p_since
      and coalesce(h.source, '') <> 'sync'
      and h.user_id is not null
  )
  select
    (date_trunc(
      case when p_unit in ('hour', 'day', 'month') then p_unit else 'day' end,
      at at time zone p_tz
    ) at time zone p_tz) as bucket,
    count(distinct uid) as visitors
  from src
  where trim(uid) <> ''
  group by 1
  order by 1;
$$;

revoke all on function public.dashboard_unique_visitors(timestamptz, text, text, text[]) from public;
revoke all on function public.dashboard_unique_visitors(timestamptz, text, text, text[]) from anon, authenticated;
grant execute on function public.dashboard_unique_visitors(timestamptz, text, text, text[]) to service_role;

-- Refresh PostgREST so the new function is callable immediately.
notify pgrst, 'reload schema';
