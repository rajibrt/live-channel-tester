-- Multiple stream links per TV channel, with automatic failover in the player.
-- Run once in the Supabase SQL Editor. Safe to re-run. Does not delete anything.
--
-- channels.stream_url stays as the "primary" link for compatibility (imports,
-- public M3U, local agent). The app keeps it equal to the top active source.

create table if not exists public.channel_sources (
  id bigint generated always as identity primary key,
  channel_id bigint not null references public.channels(id) on delete cascade,
  stream_url text not null,
  -- collection / provider name, e.g. "bdix-a", "Collection 2"
  label text not null default '',
  priority integer not null default 0,
  is_active boolean not null default true,
  -- viewer-reported playback results (any ISP)
  success_count integer not null default 0,
  failure_count integer not null default 0,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (channel_id, stream_url)
);

create index if not exists channel_sources_channel_priority_idx
  on public.channel_sources (channel_id, priority, id);

alter table public.channel_sources enable row level security;
revoke all on public.channel_sources from anon, authenticated;

-- Backfill: every channel's current stream_url becomes its first source.
insert into public.channel_sources (channel_id, stream_url, label, priority, is_active)
select c.id, c.stream_url, 'primary', 0, true
from public.channels c
where coalesce(c.stream_url, '') <> ''
on conflict (channel_id, stream_url) do nothing;

-- Atomic counter update used by the activity API when a viewer's player
-- reports that a source started playing (p_ok = true) or failed.
create or replace function public.record_channel_source_result(p_source_id bigint, p_ok boolean)
returns void
language sql
security definer
set search_path = public
as $$
  update public.channel_sources
  set success_count = success_count + case when p_ok then 1 else 0 end,
      failure_count = failure_count + case when p_ok then 0 else 1 end,
      last_success_at = case when p_ok then now() else last_success_at end,
      last_failure_at = case when p_ok then last_failure_at else now() end
  where id = p_source_id;
$$;

revoke all on function public.record_channel_source_result(bigint, boolean) from public;
revoke all on function public.record_channel_source_result(bigint, boolean) from anon, authenticated;
grant execute on function public.record_channel_source_result(bigint, boolean) to service_role;

notify pgrst, 'reload schema';
