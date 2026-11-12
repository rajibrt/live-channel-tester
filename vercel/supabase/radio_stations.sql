-- Radio stations (separate from TV channels) with ordered failover links.
-- Run once in the Supabase SQL Editor. Safe to re-run.

create table if not exists public.radio_stations (
  id bigint generated always as identity primary key,
  name text not null,
  name_bn text not null default '',
  band text not null default 'FM' check (band in ('FM', 'AM', 'Online')),
  -- MHz for FM, kHz for AM, null for online-only stations
  frequency numeric(6,1),
  city text not null default '',
  logo_url text not null default '',
  is_active boolean not null default true,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Added 2026-11-12: station group shown as tabs on /radio (e.g. Bangladesh, India · Bangla, India · Hindi).
alter table public.radio_stations add column if not exists region text not null default 'Bangladesh';

create table if not exists public.radio_station_sources (
  id bigint generated always as identity primary key,
  station_id bigint not null references public.radio_stations(id) on delete cascade,
  stream_url text not null,
  label text not null default '',
  priority integer not null default 0,
  is_active boolean not null default true,
  success_count integer not null default 0,
  failure_count integer not null default 0,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (station_id, stream_url)
);

create index if not exists radio_station_sources_station_priority_idx
  on public.radio_station_sources (station_id, priority, id);

alter table public.radio_stations enable row level security;
alter table public.radio_station_sources enable row level security;
revoke all on public.radio_stations from anon, authenticated;
revoke all on public.radio_station_sources from anon, authenticated;

-- Viewer playback results per link (called by the server with the service role).
create or replace function public.record_radio_source_result(p_source_id bigint, p_ok boolean)
returns void
language sql
security definer
set search_path = public
as $$
  update public.radio_station_sources
     set success_count = success_count + case when p_ok then 1 else 0 end,
         failure_count = failure_count + case when p_ok then 0 else 1 end,
         last_success_at = case when p_ok then now() else last_success_at end,
         last_failure_at = case when p_ok then last_failure_at else now() end
   where id = p_source_id;
$$;
revoke all on function public.record_radio_source_result(bigint, boolean) from public, anon, authenticated;
grant execute on function public.record_radio_source_result(bigint, boolean) to service_role;

notify pgrst, 'reload schema';
