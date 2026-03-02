# Dokploy Deployment (WEBTVBD)

## 1) What is already prepared

- Dockerized Next.js production build with `standalone` output.
- Auto build versioning enabled in `next.config.mjs`.
  - If `APP_BUILD_VERSION` is provided, that value is used.
  - If not provided, every build gets an auto version like `2026-03-02T171000Z-abc1234`.
- Service worker URL now uses `NEXT_PUBLIC_BUILD_VERSION`, so every build busts old SW cache automatically.

## 2) Dokploy project settings

- **Project type**: Dockerfile
- **Root directory**: `vercel`
- **Dockerfile path**: `Dockerfile`
- **Port**: `3000`
- **Start command**: leave default (Dockerfile `CMD` is set)

## 3) Environment variables (Dokploy)

Set the same values you use in production:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `PUBLIC_PLAYLIST_BASE_URL`
- `LOCAL_AGENT_BASE_URL`
- `CRON_SECRET`
- `CRON_CHECK_TIMEOUT_SEC`
- `CRON_CHECK_CONCURRENCY`
- `CRON_CHECK_LIMIT`
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- `WEB_PUSH_VAPID_PUBLIC_KEY`
- `WEB_PUSH_VAPID_PRIVATE_KEY`
- `WEB_PUSH_VAPID_SUBJECT`
- `NEXT_PUBLIC_ANDROID_APP_URL`
- `NEXT_PUBLIC_SITE_URL`

Optional:

- `APP_BUILD_VERSION` (if you want to manually control build version label)

## 4) Version bump per build

No manual bump is required now.

- Every Dokploy build gets a unique version automatically (timestamp + git sha fallback).
- If your Dokploy supports custom build args, you can explicitly pass `APP_BUILD_VERSION`.

## 5) Local test (optional)

From `vercel/`:

```bash
npm run docker:build
npm run docker:run
```

Then open `http://localhost:3000`.
