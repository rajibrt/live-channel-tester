# M3U Live Checker

Primary stack is now **Next.js admin dashboard** in `vercel/`.

## Primary Workflow (Next.js)

1. Run local agent (ISP route check):

```bash
python -m uvicorn local_agent:app --host 127.0.0.1 --port 8787
```

2. Run dashboard:

```bash
npm --prefix vercel install
npm --prefix vercel run dev
```

3. Open:
- `http://localhost:3000/login`
- `http://localhost:3000/dashboard/local-check`

## Local Check Features

- Playlist URL or `.m3u/.m3u8` file input
- Realtime counters (total, checking now, live, dead)
- LIVE stream preview
- Pause / Resume / Stop during run
- Save LIVE only / Save all checked
- Merge with existing playlist
  - Duplicate stream URL skipped
  - Duplicate names auto renamed (`Name`, `Name 1`, ...)
  - Duplicate URL list shown after save

## Supabase Setup

1. Create project and run schema:
- `vercel/supabase/schema.sql`

2. Ensure storage bucket exists:
- `playlists` (public)

3. Required env in Vercel/Next app:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `PUBLIC_PLAYLIST_BASE_URL`
- `JWT_SECRET`
- `CRON_SECRET`
- `CRON_CHECK_TIMEOUT_SEC` (optional, default `8`)
- `CRON_CHECK_CONCURRENCY` (optional, default `6`)
- `CRON_CHECK_LIMIT` (optional, default `0`, means all)

4. Add admin user in Supabase:
- Table: `admin_users`
- Set: `user_id`, `email`, `is_active=true`

## Deploy (Vercel)

- Set project **Root Directory** to `vercel`
- Framework preset: `Next.js`
- Keep Build/Install/Output defaults (no custom overrides)

Public playlist URL format:

`https://your-app.vercel.app/playlist/{token}.m3u`

## Hourly Auto Health Check (Cron)

- Endpoint: `/api/cron/playlist-health`
- Schedule: every hour (`0 * * * *`)
- Behavior:
  - Checks saved playlist links (including currently DEAD rows)
  - Auto sets live links to `LIVE`
  - Auto sets dead links to `DEAD`
  - Public `.m3u` output includes only `LIVE` links, so dead links stay off automatically

### Notes

- `CRON_SECRET` must be a plain random string, e.g. `my-long-random-secret-123`.
- Do **not** put code snippet in `CRON_SECRET`.
- Run latest `vercel/supabase/schema.sql` so `job_runs` table exists (used by Dashboard "Last Cron Run" widget).

## Legacy Components (Fallback Only)

These still exist temporarily for fallback/debug, but are no longer the primary UI:

- `app.py`
- `templates/`
- `static/`

Cleanup phase will remove them after final stability confirmation.
