# M3U Live Checker

Primary stack is now **Next.js admin dashboard** in `vercel/`.

## Primary Workflow (Next.js)

1. Install dashboard deps:

```bash
npm --prefix vercel install
```

2. Run local agent (ISP route check):

```bash
python3 -m uvicorn local_agent:app --host 127.0.0.1 --port 8787
```

3. Run dashboard:

```bash
npm --prefix vercel run dev
```

4. Open:
- `http://localhost:3000/login`
- `http://localhost:3000/dashboard/local-check`

## New Instructions: Local Docker Live Deploy

Use this section if you want full local live deployment (server + website + dashboard) from Docker.

### 1) Start all services

```bash
docker compose up -d --build
```

### 2) If port `3000` is already in use

```bash
DASHBOARD_PORT=3001 docker compose up -d --build
```

### 3) Open live URLs

- Dashboard Home: `http://localhost:3000` (or `http://localhost:3001` if you used `DASHBOARD_PORT=3001`)
- Login: `http://localhost:3000/login` (or `:3001/login`)
- Local Check Dashboard: `http://localhost:3000/dashboard/local-check` (or `:3001/dashboard/local-check`)
- Local Agent Health: `http://localhost:8787/health`

### 4) Manage running containers

```bash
# Running status
docker compose ps

# Logs
docker compose logs -f

# Restart everything with rebuild
docker compose up -d --build

# Stop everything
docker compose down
```

### 5) Important notes

- Keep `.env` in project root with required Supabase/app secrets.
- Dashboard talks to local agent internally via Docker network using `LOCAL_AGENT_BASE_URL=http://local-agent:8787`.
- If real secrets are exposed in tracked files, rotate them immediately.

## Local Check - Hosted Vercel Workflow (Important)

If you open `https://your-app.vercel.app/dashboard/local-check`, do **not** use `127.0.0.1` as agent URL.

Use 2 terminals:

1. Terminal 1: run local agent

```bash
python3 -m uvicorn local_agent:app --host 0.0.0.0 --port 8787
```

2. Terminal 2: expose local agent with tunnel

```bash
cloudflared tunnel --url http://127.0.0.1:8787
```

If `cloudflared` is missing:

```bash
brew install cloudflared
```

3. Copy generated `https://...trycloudflare.com` URL.
4. In Vercel Local Check page, set `Local Agent Base URL` to that HTTPS tunnel URL.
5. Verify tunnel health in browser:
   - `https://<your-trycloudflare-domain>/health`
6. Run check.

## Local Check - Recommended Inputs

- Prefer direct `.m3u/.m3u8` URL (avoid short links like `da.gd` when possible)
- Or upload `.m3u` file directly
- Start with:
  - `Timeout (sec)`: `8`
  - `Hard Timeout (sec)`: `15-20`
  - `Max Items`: `20` (for first test)
  - `Verify Segment`: enabled

## Local Check Troubleshooting

- Error: `Local Agent Base URL uses localhost/127.0.0.1...`
  - Cause: hosted Vercel cannot access your PC localhost
  - Fix: use tunnel URL (`https://...trycloudflare.com`)

- Error: `Failed to reach local agent...`
  - Fix: confirm agent is running and health works:
    - `http://127.0.0.1:8787/health` (local)
    - `https://<tunnel-domain>/health` (public tunnel)

- Run stuck at a specific index
  - Use `Hard Timeout (sec)` (already supported in UI)
  - Reduce `Timeout`, or temporarily lower `Max Items` for debugging


## IPTV Home UI

- Route `/` now serves the IPTV Web Application UI.
- Design reference source: `_IPTV_Web_Application_UI_Design/` (used for layout/components/visual style).
- Existing admin and API routes remain unchanged (e.g. `/dashboard`, `/playlist/<token>.m3u`, `/api/*`).

- Home (`/`) IPTV channels are loaded from saved playlists using LIVE status only.
- Home now merges categories by name across multiple playlists and de-duplicates by `stream_url` (same stream appears once).
- Per-channel "Show" toggle in Playlist Editor controls whether a LIVE channel appears on Home.

### DB Update For Home Toggle

Run once in Supabase SQL editor if your database was created before this feature:

```sql
alter table public.channels add column if not exists include_on_home boolean not null default true;
```

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
