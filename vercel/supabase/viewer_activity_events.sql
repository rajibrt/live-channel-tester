-- Unified viewer analytics for both logged-in clients and guest visitors.
-- Run this in Supabase SQL editor before relying on the new dashboard counters.

create table if not exists public.viewer_activity_events (
  id bigint generated always as identity primary key,
  viewer_type text not null default 'guest' check (viewer_type in ('guest', 'client')),
  viewer_key text not null,
  user_id uuid null references public.client_users(user_id) on delete set null,
  event_type text not null,
  event_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists viewer_activity_events_time_idx
on public.viewer_activity_events(created_at desc);

create index if not exists viewer_activity_events_type_time_idx
on public.viewer_activity_events(event_type, created_at desc);

create index if not exists viewer_activity_events_viewer_time_idx
on public.viewer_activity_events(viewer_type, viewer_key, created_at desc);

create index if not exists viewer_activity_events_user_time_idx
on public.viewer_activity_events(user_id, created_at desc)
where user_id is not null;

create index if not exists viewer_activity_events_channel_idx
on public.viewer_activity_events((event_data->>'channel_id'), created_at desc)
where event_type in ('channel_select', 'presence_ping', 'playback_attempt', 'playback_failed', 'watch_session');

alter table public.viewer_activity_events enable row level security;

drop policy if exists deny_all_viewer_activity_events on public.viewer_activity_events;
create policy deny_all_viewer_activity_events
on public.viewer_activity_events for all using (false) with check (false);
