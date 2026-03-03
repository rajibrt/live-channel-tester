# Dokploy Deployment (WEBTVBD)

This project is deployed to Dokploy using a prebuilt Docker image.

Primary reference:

- `vercel/docs/prod-deploy-checklist.md`

## Current Deploy Mode

- Provider: `Docker Image`
- Image: `rajibrt/webtvbd:latest`
- Internal/App Port: `3000`
- Start command: **empty/default**

## Critical Requirement

Build and push image as multi-arch so Dokploy can pull on any node arch:

```bash
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -f Dockerfile \
  -t rajibrt/webtvbd:latest \
  --push \
  .
```

If `linux/arm64` is missing, Dokploy may fail with:

- `no matching manifest for linux/arm64/v8`

## Required Env (minimum)

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SITE_URL`
- `NEXT_PUBLIC_SITE_URL`

Keep all existing production envs that app features need (`PUBLIC_PLAYLIST_BASE_URL`, push keys, cron keys, etc.).

## Digest Verification

After push, check digest locally:

```bash
docker pull rajibrt/webtvbd:latest
docker image inspect rajibrt/webtvbd:latest --format '{{index .RepoDigests 0}}'
```

In Dokploy deploy logs, confirm pulled digest matches.

## Quick Debug Hints

- `Bad Gateway (502)`:
  - container likely exited
  - check Start Command override and port `3000`

- redirect issues:
  - ensure latest image is deployed
  - verify `SITE_URL` and `NEXT_PUBLIC_SITE_URL`
