create table if not exists public.signup_security_events (
  id bigint generated always as identity primary key,
  ip_hash text not null default '',
  device_hash text not null default '',
  email_hash text not null default '',
  mobile_hash text not null default '',
  status text not null default 'unknown',
  reason text not null default '',
  user_agent text not null default '',
  accept_language text not null default '',
  device_platform text not null default '',
  details_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists signup_security_events_ip_time_idx
on public.signup_security_events(ip_hash, created_at desc);

create index if not exists signup_security_events_device_time_idx
on public.signup_security_events(device_hash, created_at desc);

create index if not exists signup_security_events_status_time_idx
on public.signup_security_events(status, created_at desc);

alter table public.signup_security_events enable row level security;

drop policy if exists deny_all_signup_security_events on public.signup_security_events;
create policy deny_all_signup_security_events
  on public.signup_security_events
  for all
  using (false)
  with check (false);
