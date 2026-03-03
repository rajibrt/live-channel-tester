# WEBTVBD Production Deploy Checklist (Docker Image -> Dokploy)

This is the standard release flow for this project when using Docker image deploy in Dokploy.

## One-time Setup (Dokploy)

- Provider: `Docker Image`
- Image: `rajibrt/webtvbd:latest`
- Internal/App Port: `3000`
- Start Command: **empty** (use Dockerfile default `CMD ["node","server.js"]`)
- Clean Cache: keep available for redeploy when needed

Required production env values:

- `SUPABASE_URL=https://<project>.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY=...`
- `NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY=...`
- `SITE_URL=https://webtvbd.com`
- `NEXT_PUBLIC_SITE_URL=https://webtvbd.com`

Also keep existing app envs already used in production (`PUBLIC_PLAYLIST_BASE_URL`, push keys, cron values, etc.).

## Every Release (ধারাবাহিক ধাপ)

নীচের ধাপগুলো **প্রতিবার** follow করুন (code change -> git push -> image push -> Dokploy deploy):

## 1) কোড পরিবর্তন শেষ করে local build check

Repo root:

```bash
git status
```

`vercel/` folder:

```bash
npm run build
```

## 2) Git commit + push

Repo root:

```bash
git add .
git commit -m "your message"
git push origin master
```

## 3) Multi-arch image build + push (`latest`)

`vercel/` folder:

```bash
docker buildx create --use --name dokploybuilder || true
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -f Dockerfile \
  -t rajibrt/webtvbd:latest \
  --push \
  .
```

### One-line Release Command (buildx + push + verify)

From repo root:

```bash
cd vercel && docker buildx create --use --name dokploybuilder >/dev/null 2>&1 || true && docker buildx build --platform linux/amd64,linux/arm64 -f Dockerfile -t rajibrt/webtvbd:latest --push . && docker buildx imagetools inspect rajibrt/webtvbd:latest && docker pull rajibrt/webtvbd:latest && docker image inspect rajibrt/webtvbd:latest --format '{{index .RepoDigests 0}}'
```

তারপর Dokploy UI থেকে deploy দিন (`Deploy` / `Rebuild`)।

## 4) Image platform + digest verify

```bash
docker buildx imagetools inspect rajibrt/webtvbd:latest
docker pull rajibrt/webtvbd:latest
docker image inspect rajibrt/webtvbd:latest --format '{{index .RepoDigests 0}}'
```

Confirm:

- both platforms exist: `linux/amd64` and `linux/arm64`
- digest is visible and updated

## 5) Dokploy deploy

- Keep image as `rajibrt/webtvbd:latest`
- Click `Deploy` (or `Rebuild`)
- If needed, enable `Clean Cache` and deploy again

In deployment logs, verify pulled digest matches what you saw locally (`RepoDigest`).

## 6) Deploy এর পরে smoke test

- Open `https://webtvbd.com/login`
- Open dashboard login and sign in
- Confirm it does not redirect to `0.0.0.0`
- Open main dashboard page successfully

## Quick Troubleshooting

- `no matching manifest for linux/arm64/v8`:
  - image was pushed without arm64; rebuild with multi-arch command above.

- Same old digest in Dokploy:
  - new image was not pushed; run `docker buildx build ... --push` again.

- `Bad Gateway (502)`:
  - container not running; check Dokploy service settings:
  - Start Command must be empty/default
  - Internal port must be `3000`
  - env values must be valid (especially Supabase URL keys)

- Redirect goes to `0.0.0.0`:
  - deploy latest code and ensure `SITE_URL` + `NEXT_PUBLIC_SITE_URL` are correct.
