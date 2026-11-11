-- Media details (codecs, reachability) for movie source URLs.
-- Filled by vercel/scripts/scan-movie-media-info.mjs, which must run on a
-- machine inside the ISP network (the sources are private BDIX FTP hosts).
-- Keyed by source_url so it survives admin edits that recreate movie_sources rows.
-- Run once in the Supabase SQL Editor. Safe to re-run.

create table if not exists public.movie_source_media_info (
  source_url text primary key,
  status text not null check (status in ('ok', 'unreachable', 'error')),
  http_status integer,
  container text,
  video_codec text,
  audio_codecs text[] not null default '{}',
  -- false when no audio stream is decodable by Chrome/Android WebView (e.g. only ac3/eac3/dts)
  browser_audio_ok boolean,
  duration_seconds integer,
  error text,
  probed_at timestamptz not null default now()
);

create index if not exists movie_source_media_info_browser_audio_idx
  on public.movie_source_media_info (browser_audio_ok)
  where browser_audio_ok = false;

alter table public.movie_source_media_info enable row level security;
revoke all on public.movie_source_media_info from anon, authenticated;

notify pgrst, 'reload schema';
