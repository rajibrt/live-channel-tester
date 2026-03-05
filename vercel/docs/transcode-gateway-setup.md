# Transcode Gateway Setup (Fix Domain No-Sound on LAN Sources)

Use this when:

- `localhost` can play audio
- domain can play video but no audio
- compatibility mode fails with timeout to `10.x.x.x` / `192.168.x.x`

## Why it happens

Your public app server cannot reach your private LAN source URL (example: `http://10.1.1.1/data/...`).

## Solution

Run a small transcode gateway **inside the same LAN** where `10.1.1.1` is reachable, then point app env to it.

---

## 1) Build and run gateway (LAN machine)

From repo root:

```bash
cd vercel/transcode-gateway
docker build -t webtvbd-transcode-gateway:latest .
docker run -d --name webtvbd-transcode-gateway \
  -p 8787:8787 \
  -e STREAM_TRANSCODE_FORCE_VIDEO_REENCODE=true \
  -e STREAM_TRANSCODE_GATEWAY_TOKEN=replace_me_long_random_token \
  -e CORS_ALLOW_ORIGIN=https://webtvbd.com \
  webtvbd-transcode-gateway:latest
```

Health check:

```bash
curl http://127.0.0.1:8787/health
```

---

## 2) Expose gateway over HTTPS

Expose this LAN gateway with your preferred method:

- Nginx reverse proxy + SSL
- Cloudflare Tunnel
- Tailscale Funnel
- Any secure HTTPS endpoint

Example final URL:

`https://transcode.webtvbd.com/api/stream-transcode`

---

## 3) Set app env in Dokploy (WEBTVBD app)

```env
STREAM_TRANSCODE_GATEWAY_URL=https://transcode.webtvbd.com/api/stream-transcode
STREAM_TRANSCODE_GATEWAY_TOKEN=replace_me_long_random_token
STREAM_TRANSCODE_FORCE_VIDEO_REENCODE=true
```

Optional (force compatibility mode always):

```env
NEXT_PUBLIC_STREAM_ALWAYS_COMPAT_MODE=true
```

Then redeploy app.

---

## 4) Verify in browser

For problematic movie:

- Network should call:
  - `https://webtvbd.com/api/stream-transcode?...`
- API response headers should include:
  - `x-stream-transcode: gateway-relay`
- Audio should play.

If still failing, inspect `/api/stream-transcode` response JSON `details`.
