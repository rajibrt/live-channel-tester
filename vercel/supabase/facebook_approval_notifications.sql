-- Facebook signup + approval workflow + admin notifications migration

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

create index if not exists client_users_approval_status_idx on public.client_users(approval_status);
create index if not exists client_users_provider_user_id_idx on public.client_users(provider_user_id);
create index if not exists client_users_last_watched_at_idx on public.client_users(last_watched_at desc);
create index if not exists admin_notifications_created_idx on public.admin_notifications(created_at desc);
create index if not exists admin_notifications_read_idx on public.admin_notifications(is_read, created_at desc);
create index if not exists admin_push_subscriptions_admin_idx on public.admin_push_subscriptions(admin_user_id, is_active);

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

alter table public.admin_notifications enable row level security;
alter table public.admin_push_subscriptions enable row level security;

drop policy if exists deny_all_admin_notifications on public.admin_notifications;
create policy deny_all_admin_notifications on public.admin_notifications for all using (false) with check (false);
drop policy if exists deny_all_admin_push_subscriptions on public.admin_push_subscriptions;
create policy deny_all_admin_push_subscriptions on public.admin_push_subscriptions for all using (false) with check (false);
