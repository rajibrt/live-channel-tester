-- Movies module migration
-- Safe to run multiple times.

create table if not exists public.movies (
  id bigint generated always as identity primary key,
  slug text not null unique,
  title text not null,
  synopsis text not null default '',
  poster_url text not null default '',
  backdrop_url text not null default '',
  release_year integer null,
  runtime_seconds integer not null default 0,
  imdb_id text null,
  imdb_url text not null default '',
  imdb_rating numeric(3,1) null,
  imdb_votes integer null,
  content_rating text not null default '',
  imdb_genres text[] not null default '{}',
  imdb_directors text[] not null default '{}',
  imdb_writers text[] not null default '{}',
  imdb_stars text[] not null default '{}',
  imdb_release_date text not null default '',
  imdb_countries text[] not null default '{}',
  imdb_languages text[] not null default '{}',
  video_quality text not null default '',
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.movies add column if not exists imdb_id text null;
alter table public.movies add column if not exists imdb_url text not null default '';
alter table public.movies add column if not exists imdb_rating numeric(3,1) null;
alter table public.movies add column if not exists imdb_votes integer null;
alter table public.movies add column if not exists content_rating text not null default '';
alter table public.movies add column if not exists imdb_genres text[] not null default '{}';
alter table public.movies add column if not exists imdb_directors text[] not null default '{}';
alter table public.movies add column if not exists imdb_writers text[] not null default '{}';
alter table public.movies add column if not exists imdb_stars text[] not null default '{}';
alter table public.movies add column if not exists imdb_release_date text not null default '';
alter table public.movies add column if not exists imdb_countries text[] not null default '{}';
alter table public.movies add column if not exists imdb_languages text[] not null default '{}';
alter table public.movies add column if not exists video_quality text not null default '';

create table if not exists public.movie_categories (
  id bigint generated always as identity primary key,
  slug text not null unique,
  name text not null,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.movie_category_map (
  movie_id bigint not null references public.movies(id) on delete cascade,
  category_id bigint not null references public.movie_categories(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (movie_id, category_id)
);

create table if not exists public.movie_sources (
  id bigint generated always as identity primary key,
  movie_id bigint not null references public.movies(id) on delete cascade,
  label text not null default 'default',
  source_url text not null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.movie_watch_progress (
  user_id uuid not null references public.client_users(user_id) on delete cascade,
  movie_id bigint not null references public.movies(id) on delete cascade,
  position_seconds integer not null default 0,
  duration_seconds integer not null default 0,
  progress_percent numeric(5,2) not null default 0,
  is_completed boolean not null default false,
  last_event text not null default 'progress',
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (user_id, movie_id)
);

create table if not exists public.movie_favorites (
  user_id uuid not null references public.client_users(user_id) on delete cascade,
  movie_id bigint not null references public.movies(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, movie_id)
);

create table if not exists public.movie_recent_history (
  user_id uuid not null references public.client_users(user_id) on delete cascade,
  movie_id bigint not null references public.movies(id) on delete cascade,
  watched_at timestamptz not null default now(),
  position_seconds integer not null default 0,
  source text not null default 'progress',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, movie_id)
);

insert into public.movie_categories (slug, name, position)
values
  ('bangla', 'Bangla', 1),
  ('hindi', 'Hindi', 2),
  ('english', 'English', 3),
  ('love-story', 'Love Story', 4),
  ('family', 'Family', 5)
on conflict (slug) do update
set
  name = excluded.name,
  position = excluded.position,
  updated_at = now();

create index if not exists movies_published_updated_idx
on public.movies(is_published, updated_at desc);
create index if not exists movies_title_idx
on public.movies(title);
create unique index if not exists movies_imdb_id_unique_idx
on public.movies(imdb_id)
where imdb_id is not null;
create index if not exists movie_categories_position_idx
on public.movie_categories(position, name);
create index if not exists movie_category_map_category_movie_idx
on public.movie_category_map(category_id, movie_id);
create index if not exists movie_sources_movie_active_order_idx
on public.movie_sources(movie_id, is_active, sort_order, id);
create index if not exists movie_watch_progress_user_updated_idx
on public.movie_watch_progress(user_id, updated_at desc);
create index if not exists movie_watch_progress_movie_idx
on public.movie_watch_progress(movie_id);
create index if not exists movie_favorites_user_created_idx
on public.movie_favorites(user_id, created_at desc);
create index if not exists movie_recent_history_user_watched_idx
on public.movie_recent_history(user_id, watched_at desc);

alter table public.movies enable row level security;
alter table public.movie_categories enable row level security;
alter table public.movie_category_map enable row level security;
alter table public.movie_sources enable row level security;
alter table public.movie_watch_progress enable row level security;
alter table public.movie_favorites enable row level security;
alter table public.movie_recent_history enable row level security;

drop policy if exists deny_all_movies on public.movies;
create policy deny_all_movies on public.movies for all using (false) with check (false);
drop policy if exists deny_all_movie_categories on public.movie_categories;
create policy deny_all_movie_categories on public.movie_categories for all using (false) with check (false);
drop policy if exists deny_all_movie_category_map on public.movie_category_map;
create policy deny_all_movie_category_map on public.movie_category_map for all using (false) with check (false);
drop policy if exists deny_all_movie_sources on public.movie_sources;
create policy deny_all_movie_sources on public.movie_sources for all using (false) with check (false);
drop policy if exists deny_all_movie_watch_progress on public.movie_watch_progress;
create policy deny_all_movie_watch_progress on public.movie_watch_progress for all using (false) with check (false);
drop policy if exists deny_all_movie_favorites on public.movie_favorites;
create policy deny_all_movie_favorites on public.movie_favorites for all using (false) with check (false);
drop policy if exists deny_all_movie_recent_history on public.movie_recent_history;
create policy deny_all_movie_recent_history on public.movie_recent_history for all using (false) with check (false);
