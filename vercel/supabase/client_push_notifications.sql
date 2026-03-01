-- Client web push subscriptions
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

create index if not exists client_push_subscriptions_user_idx
  on public.client_push_subscriptions(user_id, is_active);

alter table public.client_push_subscriptions enable row level security;

drop policy if exists deny_all_client_push_subscriptions on public.client_push_subscriptions;
create policy deny_all_client_push_subscriptions
  on public.client_push_subscriptions
  for all
  using (false)
  with check (false);
