# M3U Live Checker

Small local tool to test `.m3u` playlist entries and split results into:
- `live_only.m3u`
- `dead_only.m3u`
- `report.csv`

## Setup

```bash
cd m3u-live-checker
python3 -m venv .venv
source .venv/bin/activate
python -m pip install requests rich flask
```

## Run

```bash
python checker.py sample.m3u \
  --out-live live_only.m3u \
  --out-dead dead_only.m3u \
  --report report.csv \
  --timeout 10 \
  --delay 0.2 \
  --verify-segment
```

## Run Web UI

```bash
cd m3u-live-checker
source .venv/bin/activate
python app.py
```

Then open: `http://127.0.0.1:5000`

- Upload your `.m3u` file
- Click `Test Streams`
- See real-time one-by-one checking progress
- If a playlist line has no `#EXTINF` name, URL `id` (like `id=76`) is used as initial title
- For LIVE streams, app tries to read stream manifest `NAME` and auto-updates the channel title when available
- Click `Preview + Select` on any LIVE stream
- Add `Channel Name`, `Category`, `Logo URL`, then `Save Channel`
- Saved channels appear in final list
- Use two download options:
  - `Download LIVE only .m3u (Normal)`
  - `Download Final Curated .m3u`
- Duplicate channel `name` or `stream URL` is blocked
- Last test state is saved in browser local storage + cookie chunks and restored after reload
- Click `Clear All` to reset UI state and remove cached job data

## Merge Multiple Playlists

- Use `Merge Multiple Playlists` section in web UI
- Upload multiple `.m3u` files together
- Merge rules:
  - Duplicate stream URLs are removed
  - Duplicate channel names are auto-renamed: `ABC`, `ABC 1`, `ABC 2`, ...
- Existing metadata (`name`, `category`, `logo`) is preserved when available
- Download merged output with metadata from `Download Merged .m3u`

## Local Agent (For ISP/Local Network Testing)

Run local API agent (uses your own internet route/ISP):

```bash
cd m3u-live-checker
source .venv/bin/activate
python -m uvicorn local_agent:app --host 127.0.0.1 --port 8787
```

Endpoints:
- `GET /health`
- `POST /api/test-stream` (multipart: `playlist`, `timeout`, `delay`, `max_items`, `verify_segment`)
- `POST /api/merge-playlists` (multipart: multiple `playlists`)
- `POST /api/job/{job_id}/add-channel`
- `DELETE /api/job/{job_id}`
- `GET /download/merge/{merge_id}`

This is the endpoint your future Firebase admin panel should call for real stream checks.

## UI Mode Switch (Built-in vs Local Agent)

In web UI test form:
- `Check Mode = Built-in Server` -> use Flask backend (`app.py`)
- `Check Mode = Local Agent (ISP)` -> use local agent URL (default `http://127.0.0.1:8787`)

To use Local Agent mode, run both:

```bash
# terminal 1
cd m3u-live-checker
source .venv/bin/activate
python app.py

# terminal 2
cd m3u-live-checker
source .venv/bin/activate
python -m uvicorn local_agent:app --host 127.0.0.1 --port 8787
```

## Publish Curated Playlist To Firebase (Permanent)

After checking and saving curated channels, use `Publish Online Playlist` section in UI.

Required env vars (for `app.py` or `local_agent.py` process):

- `FIREBASE_SERVICE_ACCOUNT_JSON`:
  - service account JSON file path, or
  - raw JSON string
- `FIREBASE_STORAGE_BUCKET` (example: `your-project.appspot.com`)
- `FIREBASE_PLAYLIST_BASE_URL` (example: `https://us-central1-your-project.cloudfunctions.net`)

Example (file path mode):

```bash
export FIREBASE_SERVICE_ACCOUNT_JSON="/absolute/path/service-account.json"
export FIREBASE_STORAGE_BUCKET="your-project.appspot.com"
export FIREBASE_PLAYLIST_BASE_URL="https://us-central1-your-project.cloudfunctions.net"
```

Publish result:
- Firestore `channels`, `playlists`, `playlists_public` updated
- Storage `playlists/{slug}/current.m3u` updated
- Public URL returned as: `{FIREBASE_PLAYLIST_BASE_URL}/playlist/{slug}.m3u`

## Firebase Deploy Scaffold

Project files are in `firebase/`:

- `firebase/firebase.json`
- `firebase/firestore.rules`
- `firebase/storage.rules`
- `firebase/functions/index.js`

Deploy high-level steps:

```bash
cd m3u-live-checker/firebase
firebase login
firebase use <your-project-id>
cd functions && npm install && cd ..
firebase deploy
```

Or one-command deploy:

```bash
cd m3u-live-checker/firebase
./deploy.sh <your-project-id>
```

Optional project file template:
- copy `firebase/.firebaserc.example` -> `firebase/.firebaserc`

## Vercel + Supabase (No Firebase Billing Path)

If Firebase billing blocks App Engine/Functions, use Supabase + Vercel.

### 1) Supabase setup

- Create a Supabase project
- Run SQL in `vercel/supabase/schema.sql`
- Create a Storage bucket named `playlists` (public)

### 2) Local app/agent env

Set these for `app.py` or `local_agent.py` process:

```bash
export SUPABASE_URL="https://your-project-ref.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
export PUBLIC_PLAYLIST_BASE_URL="https://your-vercel-app.vercel.app"
```

You can also create `m3u-live-checker/.env` (from `.env.example`).  
`app.py` and `local_agent.py` auto-load `.env` on startup.

Preflight check:

```bash
cd m3u-live-checker
source .venv/bin/activate
python scripts/preflight_supabase.py
```

In UI publish panel:
- Provider = `Supabase`
- Publish slug/name

### 3) Vercel endpoint deploy

Project folder: `vercel/`

```bash
cd m3u-live-checker/vercel
npm install
```

Set Vercel env vars:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Deploy to Vercel. Public playlist URL format:

`https://your-vercel-app.vercel.app/playlist/{slug}.m3u`

Or use helper:

```bash
cd m3u-live-checker/vercel
./deploy.sh
```

This URL is stable and can be used directly in TV apps.

## Notes

- Use small `--delay` and avoid high concurrency to reduce server load.
- For quick dry-runs: add `--max 1` or another small value.
