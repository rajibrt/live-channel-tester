-- Facebook signup + approval workflow + admin notifications migration

alter table public.client_users add column if not exists approval_status text not null default 'approved';
alter table public.client_users add column if not exists approved_at timestamptz null;
alter table public.client_users add column if not exists approved_by_admin uuid null references public.admin_users(user_id) on delete set null;
alter table public.client_users add column if not exists approval_note text not null default '';
alter table public.client_users add column if not exists auth_provider text not null default 'password';
alter table public.client_users add column if not exists provider_user_id text not null default '';
alter table public.client_users add column if not exists avatar_url text not null default '';
alter table public.client_users add column if not exists oauth_profile_json jsonb not null default '{}'::jsonb;

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
create index if not exists admin_notifications_created_idx on public.admin_notifications(created_at desc);
create index if not exists admin_notifications_read_idx on public.admin_notifications(is_read, created_at desc);
create index if not exists admin_push_subscriptions_admin_idx on public.admin_push_subscriptions(admin_user_id, is_active);

alter table public.admin_notifications enable row level security;
alter table public.admin_push_subscriptions enable row level security;

drop policy if exists deny_all_admin_notifications on public.admin_notifications;
create policy deny_all_admin_notifications on public.admin_notifications for all using (false) with check (false);
drop policy if exists deny_all_admin_push_subscriptions on public.admin_push_subscriptions;
create policy deny_all_admin_push_subscriptions on public.admin_push_subscriptions for all using (false) with check (false);
