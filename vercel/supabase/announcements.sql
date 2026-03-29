-- Admin announcements / article posts
create table if not exists public.admin_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content_html text not null,
  content_type text not null default 'announcement' check (content_type in ('announcement', 'article')),
  featured_image_url text not null default '',
  featured_image_path text not null default '',
  featured_image_bucket text not null default '',
  is_published boolean not null default false,
  is_pinned boolean not null default false,
  position integer not null default 0,
  show_title_in_ticker boolean not null default false,
  ticker_speed_seconds integer not null default 34,
  published_at timestamptz null,
  created_by_admin uuid null references auth.users(id) on delete set null,
  updated_by_admin uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.admin_announcements
add column if not exists ticker_speed_seconds integer not null default 34;

alter table public.admin_announcements
add column if not exists show_title_in_ticker boolean not null default false;

alter table public.admin_announcements
add column if not exists position integer not null default 0;

alter table public.admin_announcements
add column if not exists featured_image_url text not null default '';

alter table public.admin_announcements
add column if not exists featured_image_path text not null default '';

alter table public.admin_announcements
add column if not exists featured_image_bucket text not null default '';

alter table public.admin_announcements
add column if not exists content_type text not null default 'announcement';

update public.admin_announcements
set content_type = case
  when coalesce(featured_image_path, '') <> '' or coalesce(featured_image_url, '') <> '' then 'article'
  when coalesce(show_title_in_ticker, false) = true then 'announcement'
  else 'announcement'
end;

alter table public.admin_announcements
drop constraint if exists admin_announcements_content_type_check;

alter table public.admin_announcements
add constraint admin_announcements_content_type_check
check (content_type in ('announcement', 'article'));

with ordered as (
  select id, row_number() over (order by created_at asc, id asc) as rn
  from public.admin_announcements
)
update public.admin_announcements a
set position = ordered.rn
from ordered
where a.id = ordered.id
  and coalesce(a.position, 0) <= 0;

create table if not exists public.admin_settings (
  key text primary key,
  value_json jsonb not null default '{}'::jsonb,
  updated_by_admin uuid null references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.admin_settings (key, value_json)
values ('announcement_ticker', '{"speed_seconds":34,"icon_text":"•"}'::jsonb)
on conflict (key) do nothing;

create index if not exists idx_admin_announcements_created_at
  on public.admin_announcements (created_at desc);

create index if not exists idx_admin_announcements_published
  on public.admin_announcements (is_published, created_at desc);

create index if not exists idx_admin_announcements_pinned
  on public.admin_announcements (is_pinned, created_at desc);

alter table public.admin_settings enable row level security;
drop policy if exists deny_all_admin_settings on public.admin_settings;
create policy deny_all_admin_settings on public.admin_settings for all using (false) with check (false);
