# WEBTVBD Agent Handoff and Work Ledger

Last updated: 2026-11-12 (Asia/Dhaka)

## Mandatory start procedure

Every agent working in this repository must read this file before inspecting, editing, testing, committing, deploying, or advising the user.

At the beginning of a task:

1. Run `git status --short`, `git branch --show-current`, and `git log -8 --oneline`.
2. Treat all existing modified and untracked files as user-owned work. Do not discard, overwrite, reformat, or include them in a commit unless the current request clearly includes them.
3. Read the current handoff and pending work below. Verify time-sensitive external status instead of assuming this document is still current.
4. Work primarily in `vercel/` for the production Next.js website. The repository root also contains older Python/local-agent and Firebase tooling.
5. Before finishing any material task, update the current handoff if its state changed and append an entry to the Work ledger. Record facts, commands/checks, commit/deployment status, and remaining work. Never include passwords, tokens, cookies, private keys, or full environment-variable values.
6. Keep the **Production infrastructure map** below current. When you discover or change anything about servers, services, domains, deploy flow, storage, database, or scheduled jobs, update the map in the same task (with the date verified) so the next agent does not have to search again. Record the previous value when something changes.

## Production infrastructure map

Verified 2026-11-12 unless noted. Update this section whenever any of it changes; keep old values in the ledger.

### Request path

```text
Browser ──HTTPS──> DNS A record webtvbd.com = 46.62.197.37 (no Cloudflare proxy; verified 2026-11-12)
        ──> Dokploy Server 46.62.197.37 (Hetzner, arm64) ──> Traefik (Dokploy-managed)
        ──> Docker service `webtvbd-fullstack-itwefz` (Next.js standalone, port 3000)
        ──> Supabase (Postgres + auth data, REST via service role)
        ──> MinIO S3 `storage.raishahost.com` (admin-uploaded images, bucket `webtvbd`)
        ──> stream sources (IPTV HLS, ISP-local 10.1.1.1 movie server — unreachable from Hetzner)
```

### Dokploy (`https://dokploy.raishahost.com`, v0.30.8, account = site owner)

- Server: "Dokploy Server" (local) at `46.62.197.37`, arm64. A second remote server "Camera Bazar" hosts the `Camerabazar-Dedicated` project.
- Project **WEBTVBD / production** has two services:
  - `Fullstack` (app name `webtvbd-fullstack-itwefz`, description "Home page & dashboard").
    - **Provider: GitHub** (account `Dokploy-2025-10-02-…`), repo `live-channel-tester`, branch `master`, build path `/`, **Build type: Dockerfile**, Trigger: On Push, **Autodeploy: ON**, Clean Cache: ON.
    - Consequence: **every push to `origin/master` triggers a build on the Dokploy server.** The running container image is `webtvbd-fullstack-itwefz:latest` (built by Dokploy), NOT `rajibrt/webtvbd` from Docker Hub.
    - Traefik dynamic file: `/etc/dokploy/traefik/dynamic/webtvbd-fullstack-itwefz.yml`.
  - `transcode-gateway` (`webtvbd-transcodegateway-rmh1gb`), status dot grey (not running) on 2026-11-12. Traefik file `webtvbd-transcodegateway-rmh1gb.yml`.
- Docker Hub `rajibrt/webtvbd` (**public** repo): images were pushed on 2026-09-27, 2026-11-11 (`25e8a6b`), 2026-11-12 (`fce6f06`, `6a2e229`) for a possible switch to the Docker provider. Production does not use them today. If the user decides to deploy from local images, change Fullstack Provider to `Docker` → `rajibrt/webtvbd:latest` and turn Autodeploy off; never put `.env*` into the image (verified clean so far).
- Other projects on the same Dokploy (not WEBTVBD, do not touch without asking): WHMCS Backup (`puller` rclone → MinIO bucket `whmcs-backups`), RCN, Porzobekkhon (own MinIO `porzobekkhon-minio-atqe86`, host port 9000), Elevated Roots, Raisha Host (Frontend), Camerabazar-Dedicated (remote server, own MinIO with `storage.camerabazar.net`/`media.camerabazar.net`), camerabazar-prod (old, services stopped, old MinIO also mapped to camerabazar.net domains), bhphoto, ecommerce-dev, n8n.

### Dokploy compose services audit (2026-11-12)

Isolated Deployment is deprecated in Dokploy and can break Traefik routing after a host restart (caused the 2026-11-10 `storage.raishahost.com` outage). Status of every compose service:

| Project → service | Server | Isolated Deployment | Domains (verified 2026-11-12) |
|---|---|---|---|
| ecommerce-dev → `minio` (`ecommerce-minio-h1mqpn`) | Dokploy Server | **OFF** (changed 2026-11-12) | `storage.raishahost.com`:9000 200, `media.raishahost.com`:9003 200 |
| Porzobekkhon → `minio` (`porzobekkhon-minio-atqe86`) | Dokploy Server | **OFF** (changed 2026-11-12; was ON) | `s3.porzobekkhon.net`:9000 200, `media.porzobekkhon.net`:9001 200 (Cloudflare-proxied) |
| n8n → `n8n-with-postgres` (`n8n-n8nwithpostgres-ziw4vm`) | Dokploy Server | **OFF** (changed 2026-11-12; was ON) | `n8n.raishahost.com`:5678 200 |
| Camerabazar-Dedicated → `minio` (`camerabazardedicated-minio-vxa5sj`) | remote "Camera Bazar" `46.224.103.228` | **OFF** (changed 2026-11-12; was ON) | `storage.camerabazar.net` 200, `media.camerabazar.net` 200 |
| camerabazar-prod → `minio` (old) | Dokploy Server | ON (left as is; service stopped) | stopped; its domains point to the dedicated server now |
| WHMCS Backup → `puller` (`compose-bypass-mobile-pixel-hgmcem`) | Dokploy Server | OFF | none |
| RCN → `rcn-stack` (`rcn-rcnstack-yerlpe`) | Dokploy Server | OFF | not checked |

All running compose services now use `dokploy-network` for Traefik (Isolated Deployment OFF) and have `restart: unless-stopped`. Only the stopped old camerabazar-prod minio still has isolation ON; if it is ever started again, turn isolation OFF first. Rule for new compose services: keep Isolated Deployment OFF (Dokploy deprecated it; use the Advanced → Networks section instead). Not-compose services (applications, postgres) are not affected by this setting.

### Object storage (MinIO) used by WEBTVBD

- Endpoint in env: `OBJECT_STORAGE_ENDPOINT=https://storage.raishahost.com/`, public base `https://media.raishahost.com/`, provider `s3-compatible`, path-style, signed reads ON → the app serves images through `/api/media/object?bucket=…&path=…`.
- Bucket used by WEBTVBD: `webtvbd` (all `LOGO_BUCKET`/`OG_IMAGE_BUCKET`/`ARTICLE_IMAGE_BUCKET`/`OBJECT_STORAGE_BUCKET_IMAGES` = `webtvbd`; 21 announcement images reference it).
- **Which MinIO:** Dokploy project **ecommerce-dev → service `minio`** (compose `ecommerce-minio-h1mqpn`, container `ecommerce-minio-h1mqpn-minio-1`, image `minio/minio:RELEASE.2025-04-22T22-12-26Z`, arm64). Domains: `storage.raishahost.com` → container port 9000 (S3 API), `media.raishahost.com` → container port 9003 (console; started with `--console-address ":9003"`). Host ports 9002→9000, 9003→9001. Since 2026-11-12: `restart: unless-stopped`, networks `default` + external `dokploy-network`, **Isolated Deployment OFF** (Advanced tab), Traefik label `traefik.docker.network=dokploy-network`. Container networks verified: `dokploy-network` + `ecommerce-minio-h1mqpn_default`. Previous state: isolated deployment ON (network `ecommerce-minio-h1mqpn`, label pointing to it), no restart policy.
- Shared by other sites (ecommerce-dev and possibly Raisha Host). Redeploying/stopping it affects them too.

### Supabase

- Project ref `ddrmtnrnknwcpqbicdla` ("rajibrt's Project", org "m3u-live-checker"), **Free plan** (0.5 GB DB limit, 5 GB egress).
- SQL is applied manually in the Supabase SQL Editor (no DB connection string in `.env.local`). Applied SQL files are in `vercel/supabase/`; record each run in the ledger.
- Applied 2026-11-12: `dashboard_performance.sql` (time indexes + RPC `dashboard_unique_visitors`), `activity_retention.sql` (archive totals table, `prune_client_activity_events(90)`, pg_cron job `prune-client-activity-events` daily 20:30 UTC).
- Not present in production: `viewer_activity_events` table (defined in `schema.sql` but never applied), `site_articles`, `site_seo_settings`. Settings live in `admin_settings`; announcements in `admin_announcements`.
- DB size after cleanup 2026-11-12: 126 MB (was 545.69 MB).

### Deploy procedure (current reality)

1. Commit on the working branch, fast-forward `origin/master` (no force push).
2. Dokploy Autodeploy builds `master` automatically on push. Pressing **Deploy** in Dokploy rebuilds again (extra build on the server).
3. Verify live: `curl -I https://webtvbd.com/dashboard` (expect 307 → `/login` when signed out), `cd vercel && npm run audit:public`.
- The user is concerned about server build load. Options to discuss with the user, not to change silently: keep Autodeploy and stop pressing Deploy manually, or switch the Provider to Docker image built locally.

### Local tooling

- Run: `cd vercel && npm run dev -- --hostname 127.0.0.1 --webpack` (Turbopack fails to resolve Tailwind from repo root). Local agent: `python3 -m uvicorn local_agent:app --host 127.0.0.1 --port 8787`.
- Production-like local run: `npm run build` then `PORT=3100 HOSTNAME=127.0.0.1 node --env-file=.env.local .next/standalone/Projects/live-channel-tester/vercel/server.js` (standalone tracing root is the home directory).
- Import lib modules in ad-hoc Node scripts with `node_modules/jiti` (lib files use extensionless imports).
- Backups of production data live in repo-root `backups/` (git-excluded via `.git/info/exclude`; contains user data, never commit or publish).

### Useful checks

```bash
cd vercel
npm run audit:public
curl -I https://webtvbd.com/
curl -I https://webtvbd.com/dashboard
curl -I https://webtvbd.com/sitemap.xml
curl https://webtvbd.com/ads.txt
curl https://webtvbd.com/robots.txt
curl -s -o /dev/null -m 10 -w "%{http_code}\n" https://storage.raishahost.com/minio/health/live
```

### Known open issues (keep updated)

1. **MinIO restart resilience — fixed 2026-11-12.** Root cause of the 2026-11-10 outage: Dokploy's deprecated *Isolated Deployment* on ecommerce-dev `minio` made Traefik reach the container through the per-compose network `ecommerce-minio-h1mqpn`; after the host restart Traefik was no longer attached to it, so `storage/media.raishahost.com` timed out (Dokploy's own warning: isolated deployment "breaks on restarts"). Fix applied with user approval: isolated deployment OFF, `restart: unless-stopped`, explicit external `dokploy-network`, redeployed. After the next host restart, run the health check below to confirm. Other compose services: see **Dokploy compose services audit** above.
   - Health check: `curl -s -o /dev/null -w "%{http_code}" https://storage.raishahost.com/minio/health/live` → 200. If it times out, redeploy ecommerce-dev → `minio`.
2. **Movie audio (AC3) / ISP-local sources (investigated 2026-11-12):** 4,592 active `movie_sources`; by host: `cdn1.discoveryftp.net` 3,805 (DNS → `172.16.16.10`, private BDIX FTP), `www.ftpbd.net` 531 (m3u8), `172.16.50.7` 189, `172.16.50.14` 26, `server3.ftpbd.net` 26, `cinehub24.com` 10, `10.1.1.1` only 5 (sampled 10.1.1.1 files now return 404). Nearly all sources are ISP-local, so the Hetzner server can never fetch/transcode them; viewers play them directly from their own ISP network. ffprobe sample (from the user's Mac on the ISP network): 2 of 14 discoveryftp MKV had `ac3` audio, others `aac`/`opus` (some video `vp9`). Chrome/Android WebView cannot decode AC3 → video plays without sound; Safari and Edge usually can. The player loads private-network URLs directly (`resolveBrowserPlaybackUrl` keeps private HTTP URLs; `/api/stream-probe` cannot reach them from production). WireGuard via the Cudy router (old plan) would not help bandwidth-wise.
3. `viewer_activity_events` missing → guest analytics empty.
4. `transcode-gateway` service not running.
5. `/api/stream-probe` returns raw ffmpeg error text to clients (minor info leak).

## Current external handoff

### Google AdSense

- Publisher ID: `pub-3010934061489506` / client ID `ca-pub-3010934061489506`.
- Site ownership is verified in AdSense.
- The earlier rejection reason was `Low value content`.
- The user submitted a new review request on 2026-08-04.
- Latest user-provided AdSense screen shows `Getting ready` and a green `Review requested` confirmation.
- Do not delete and re-add the site or submit another review while this review is active.
- AdSense says review normally takes a few days and can take 2-4 weeks. Monitor the AdSense Sites page, Policy Center, notifications, and the associated email account.
- No visible ads before approval is expected. The repository currently has the AdSense loader but no manual `<ins class="adsbygoogle">` ad slot. After approval, enable Auto ads in AdSense or create manual ad units and add the supplied slot IDs deliberately.
- The AdSense loader is currently gated by the site's local consent choice on monetizable public routes. Verify the Google-certified CMP/European regulations message in AdSense `Privacy & messaging`; the local banner alone must not be assumed to satisfy Google's certified-CMP requirements.
- Live `ads.txt` was verified as HTTP 200 with this exact record:

```text
google.com, pub-3010934061489506, DIRECT, f08c47fec0942fa0
```

- The latest AdSense dashboard recognition state for `ads.txt` is not confirmed in this document. Check whether it has changed to `Authorized` before making claims about it.

### Google Search Console

- Correct property: Domain property `webtvbd.com`, not the old URL-prefix property `https://www.webtvbd.com/`.
- Canonical sitemap: `https://webtvbd.com/sitemap.xml`.
- Latest user-provided screen on 2026-08-04 shows `Sitemap processed successfully`, last read `8/4/26`, and `34` discovered pages.
- Do not delete or repeatedly resubmit the working sitemap.
- `Discovered` does not mean every URL is indexed. Next checks belong in Page Indexing and URL Inspection for the homepage, `/articles`, and representative new articles.
- Old Google results may temporarily show legacy slugs or old `www` content until recrawling completes. Existing permanent redirects and canonicals should remain stable.

## Public-site release completed on 2026-08-03 and 2026-08-04

The current release includes:

- Rewritten and expanded editorial content intended to address the previous low-value-content rejection.
- 22 live article URLs in the sitemap at the time of the last audit.
- Article content measured at approximately 491-832 visible words, averaging about 636 words across the 22 live articles.
- Editorial images on all audited articles, Article JSON-LD, titles, descriptions, canonical URLs, authorship/update information, headings, and external reference links.
- Editorial Policy, Editorial Team, Corrections Policy, Advertising Disclosure, About, Contact, Privacy, Cookie, Terms, and DMCA pages.
- Root homepage at `/`; `/home` is not the canonical root.
- Nine latest article cards on the homepage and an all-articles navigation action.
- Rotating image-based homepage hero.
- Mobile slide-out navigation drawer with site design tokens, logo/navigation/social/footer treatment.
- Article share actions for common networks and copy-link.
- Route-change scroll restoration so internal links open at the top of the next page.
- Article pagination, loading skeletons, and image/performance refinements.
- Siyam Rupali Bengali font loaded through the Maateen CDN.

Relevant commits, oldest to newest:

- `6584ac8` Improve public editorial quality for AdSense review
- `989923d` Refine article metadata and image delivery
- `327faa7` Expand evergreen editorial authority
- `f9139b5` Add Google submission readiness audit
- `a4b682c` Add rotating latest-article homepage hero
- `343bcb2` Flatten homepage hero content overlay
- `3f6ad16` Improve public site navigation and article experience

## Last verified audit

On 2026-08-04, from `vercel/`, `npm run audit:public` reported:

```text
Public-site audit: https://webtvbd.com
Sitemap URLs: 34
Article URLs: 22
Legacy redirects: 5
Warnings: 0
Failures: 0
```

The audit checks live robots.txt, sitemap, ads.txt, HTTP status, redirects, titles, descriptions, canonicals, H1 counts, noindex directives, Article JSON-LD, editorial images, external links, duplicate metadata, legacy redirects, and canonical www redirection. Re-run it before any future AdSense-readiness claim because production and dashboard state can change.

## Pending and next work

A. **Movie audio (AC3) plan (2026-11-12, user-approved steps 1+2, in progress):**
   1. Player notice — DEPLOYED in `2875a02` (2026-11-12): `components/movies/MoviePlayer.js` shows a Bengali notice with "VLC-তে খুলুন" (Android intent / iOS vlc-x-callback) and copy-link when (a) scan data says the source audio is browser-unsupported and the browser cannot decode it (`MediaSource.isTypeSupported`), or (b) after 4s of unmuted playback `webkitAudioDecodedByteCount === 0`. Verified in Chromium: AC3 file → 0 audio bytes, AAC file → 112 KB. Tracks `movie_audio_unsupported` activity.
   2. Codec catalog — code deployed in `2875a02`, NOT yet active: `vercel/supabase/movie_media_info.sql` (table `movie_source_media_info`, keyed by source_url) + `vercel/scripts/scan-movie-media-info.mjs` (ffprobe, must run on a machine inside the ISP network, e.g. the user's Mac). `lib/moviesData.js` attaches `source.audioCodecs/browserAudioOk/reachable` when the table exists. Pending: user runs the SQL, then run the scan (~45-60 min for ~3,800 non-HLS URLs), then commit/push.
   3. Later, after the scan shows how many AC3 files exist: decide between an ISP-local transcode gateway (existing `vercel/transcode-gateway`, Cloudflare Tunnel) or in-browser audio transcode. Also use the scan's `unreachable` rows to deactivate dead movie links.
B. **TV channel multi-source failover (requested 2026-11-12; Phase 1 DEPLOYED in `2875a02` on 2026-11-12; Phases 2-3 pending):**
   - Current facts: `channels` has one `stream_url` (UNIQUE, used as import/dedupe key); `playlist_channels` links; `playlist_groups` = per-playlist category order; status LIVE/DEAD set by a server cron that cannot reach ISP-local hosts; `components/iptv/VideoPlayer.js` (1544 lines) has no retry/alternate URL; home data `components/iptv/homeData.js` cached 60s, no paging; admin channel management spread over ~10 files / ~5.7k lines (`playlist-editor.js` 2167, `live-check-workspace.js` 1431). Admins currently add duplicates like "Ananda TV" / "Ananda TV 2" as a workaround.
   - Phase 1: table `channel_sources` (channel_id, stream_url, label/collection, priority, is_active, last_status, counters), backfill from `channels.stream_url`, keep `channels.stream_url` = top source for compatibility; home data sends ordered `sources[]`; player auto-failover (startup timeout, fatal error, long stall) with a small non-blocking "trying alternate link n/N" indicator, remembers the working source per device, reports per-source success/failure; admin "Channel sources" drawer (add/reorder/test/disable links).
   - Phase 2: "merge duplicates" tool (suggest by normalized name, keep one channel id, map favorites/history of merged ids), import a collection M3U as extra sources of existing channels instead of "Name 2" copies.
   - Phase 3: ISP-aware ranking from viewer reports (client IP → ASN/ISP), per-source/collection health dashboard, stop server-side marking of ISP-local sources as DEAD, simplify/merge editor + live-check UIs.
   - Keep `channels.id` stable (favorites, history, `/watch/{id}-slug`, analytics).
C. **Import channels from the user's traffic capture — APPLIED 2026-11-12 (see ledger); follow-ups: logos for 646 channels without one, 7-day review of unreachable links:**
   - Source file: `/Users/Kayum_1/Downloads/CSV_2026-11-11_23-07-12.csv` (copied to git-excluded `backups/imports/CSV_2026-11-11_23-07-12.csv`). It is an HTTP traffic log from the "WalaTV" app, not an M3U: 520 requests, ~53 unique `.m3u8` URLs (hosts such as `116.204.149.16`, `alvetv.com`, `app24.jagobd.com.bd`, `tvsen6.aynaott.com`, `85.237.89.160:9590`, `27.124.71.27`) and ~57 logo/image requests (`images.weserv.nl`, `i.imgur.com`, `trendnestbd.com`).
   - Task: extract the stream links (prefer master `index.m3u8` over `tracks-*/mono.m3u8` variants), play-test each from the ISP network, identify the channel (Bangladeshi / Indian / other), then add it to the right channel and group — as a backup link (`channel_sources`) when the channel already exists, otherwise as a new channel. Set an appropriate logo only when the channel has none. Present the mapping to the user before writing, and follow the local-review rule.
   - Extended scope (user, 2026-11-12), same task: reduce the number of categories (merge unnecessary/duplicate groups such as "SPORTS CHANNELS" vs "Sports", "INDIAN CHANNELS" vs "India"/"Indian Bangla"), remove dead channels that no longer play, and move channels sitting in the wrong category to the right one. Propose the new category list and the moves to the user before applying. Local and production share one Supabase DB, so data changes are live immediately (no deploy needed).
0. (2026-11-12) Infrastructure items: see **Known open issues** in the Production infrastructure map (MinIO network, 10.1.1.1, viewer analytics table, transcode-gateway). Decide with the user whether to keep Dokploy Git autodeploy or switch to locally built Docker images.

1. Monitor the active AdSense review; do not resubmit while status is `Getting ready`.
2. Verify the AdSense `ads.txt` dashboard state becomes `Authorized`.
3. Verify or publish a Google-certified CMP/European regulations message in AdSense `Privacy & messaging`.
4. Monitor Search Console Page Indexing and use URL Inspection for priority pages; do not confuse sitemap discovery with indexing.
5. If AdSense approves the site, configure Auto ads or create manual ad units, then verify actual impressions without an ad blocker and with consent behavior tested.
6. Continue publishing original, reviewed, useful editorial content without making disruptive canonical/URL changes during review.
7. If AdSense rejects the site again, preserve the exact rejection email, status screenshots, date, Policy Center details, and affected URLs before making further changes.

## Existing local user work to preserve

At the time this file was created, the worktree already contained these unrelated or not-yet-scoped changes:

```text
M  vercel/app/dashboard/LocalAgentPanel.js
M  vercel/app/dashboard/channels/ChannelAttachForm.js
M  vercel/app/dashboard/page.module.css
?? vercel/docs/editorial-image-generation-batch-2026-08-03.md
?? vercel/lib/staticEditorialArticlesPhase2.js
?? vercel/scripts/publish-phase2-articles.mjs
```

Re-check `git status` every time. This list is a historical snapshot, not permission to modify or commit those files. Some Phase 2 articles were already live through production data even though helper/source files remained untracked locally; verify the live site and data flow before drawing conclusions.

## Work-ledger rules

- Append new entries below in chronological order; do not erase prior entries.
- Use Asia/Dhaka dates and include time when it matters.
- Record: user goal, files changed, verification performed, commit hash/branch, deployment result, external dashboard state, and explicit follow-up.
- Distinguish `verified` facts from `reported by user` and `pending/unverified` facts.
- If a prior status becomes stale, update the Current external handoff and add a ledger entry explaining the transition.
- Do not claim deployment, indexing, approval, authorization, email delivery, or external submission without direct evidence.

## Work ledger

### 2026-08-03 to 2026-08-04 - Public editorial and AdSense-readiness release

- Goal: address the AdSense `Low value content` rejection and improve the complete public reading experience.
- Result: implemented the public-site release summarized above through commits `6584ac8` to `3f6ad16`.
- Deployment correction: Dokploy originally rebuilt old `master` commit `343bcb2`; `3f6ad16` was then fast-forwarded to `origin/master` without force-push and the new production build was verified live.
- Verification: production assets returned HTTP 200; the new header/font/build appeared live; public audit later completed with 34 sitemap URLs, 22 articles, 5 redirects, 0 warnings, and 0 failures.

### 2026-08-04 - Search Console property and sitemap correction

- User initially submitted the sitemap under URL-prefix property `https://www.webtvbd.com/`, while production canonicals use non-www.
- User selected the correct Domain property `webtvbd.com` and submitted `https://webtvbd.com/sitemap.xml`.
- Search Console briefly displayed `Could not fetch`; live HTTP, Googlebot user-agent, robots, DNS, content type, and XML validity checks passed.
- Latest user evidence shows `Sitemap processed successfully`, last read 2026-08-04, with 34 discovered pages.

### 2026-08-04 - AdSense review submitted

- User confirmed the fixed-issues checkbox and submitted the AdSense site review.
- Latest user evidence shows `Getting ready`, verified ownership, and green `Review requested` status.
- Follow-up: wait for Google's result; monitor ads.txt recognition, CMP configuration, indexing, and email/Policy Center notices. Do not delete or resubmit the site during the active review.

### 2026-08-04 - Created repository handoff ledger

- Added root `AGENTS.md` to make the current production, Search Console, AdSense, deployment, dirty-worktree, audit, and follow-up state available to future agents.
- Future agents must maintain this file after material work.

### 2026-09-27 - Started local website and channel tester

- Goal: run the server, client site, and channel tester locally.
- Started Next.js from `vercel/` using `npm run dev -- --hostname 127.0.0.1 --webpack` on port 3000 and the Python agent using `python3 -m uvicorn local_agent:app --host 127.0.0.1 --port 8787`.
- Verification: `/` and `/dashboard/local-check` returned HTTP 200; agent `/health` returned `ok: true`.
- Default Turbopack startup failed to resolve Tailwind from the repository root; Webpack startup succeeded. Local port binding required execution outside the sandbox.
- Files changed: appended this ledger only; existing user work preserved. Branch remains `agent/improve-public-site-experience` at `3f6ad16`; no commit or deployment performed. External dashboards were not checked.
- Follow-up: services are running for local use; no channel scan was initiated.

### 2026-09-27 - Fixed dashboard user count truncation

- Goal: investigate dashboard showing 1,000 users while the client base is reported to be about 5,000.
- Finding: Supabase list queries were using the default 1,000-row response cap. This affected `Total Users` and the Clients page list.
- Files changed: `vercel/lib/dashboardReports.js` and `vercel/app/dashboard/clients/page.js`; added paginated 1,000-row fetches until the final short page.
- Verification: source diff reviewed; the running Next.js dev server compiled the affected dashboard route successfully. A separate `next build` was blocked because the dev/build lock is already held by the running local server.
- Branch remains `agent/improve-public-site-experience`; no commit or deployment performed. Existing user modifications were preserved.
- Follow-up: refresh the dashboard and Clients page; the count should reflect all rows available to the service role. If it still differs, inspect the actual Supabase `client_users` count and auth-user count separately.

### 2026-09-27 - Fixed client login destination

- Goal: send an approved client from the login form into the TV live viewing area instead of the public editorial home.
- Finding: successful client login and an already-authenticated visit to `/client-login` both redirected to `/`, while the intended viewer entry route is `/watch`.
- Files changed: `vercel/app/api/client/auth/login/route.js`, `vercel/app/client-login/page.js`, and `vercel/app/client-login/ClientAuthTabs.js`.
- Result: login now defaults to `/watch`, preserves a validated same-origin `next` path, and authenticated visits to the login page redirect to `/watch`. Pending users retain the pending destination.
- Verification: `/client-login` returned HTTP 200 on the running local server and `git diff --check` passed. No commit or deployment performed.
- Follow-up: log in with an approved client and verify `/watch` loads a channel. If `/watch` falls back to `/`, inspect live playlist/channel data returned by `getHomeIptvData()`.

### 2026-09-27 - Production release pushed and image published

- Goal: publish the complete project and prepare the Dokploy production deployment.
- Verification: `npm run build` succeeded; commit `4078f8e` was pushed to `origin/master`.
- Image: multi-arch `rajibrt/webtvbd:latest` build and push succeeded. Verified manifest digest is `sha256:2f42ddc1c65d81a7d3cd67fa33262d5d5a6964084e1077e2b70c05b505f5f40`, with `linux/amd64` and `linux/arm64` manifests; local pull returned the same digest.
- Dokploy deployment: pending manual UI action because no browser session was available in this environment. Open the `WEBTVBD / production` project, select the `Fullstack` service, and click `Deploy` or `Rebuild`; confirm the pulled digest matches the image digest above.

### 2026-11-11 - Security hardening for media and stream routes

- Goal: fix security issues found during project analysis.
- `/api/media/object` previously downloaded any bucket/path with service credentials and no auth. It now serves only public media buckets (`LOGO_BUCKET`, `OG_IMAGE_BUCKET`, `ARTICLE_IMAGE_BUCKET`, `OBJECT_STORAGE_BUCKET_IMAGES`, optional comma list `OBJECT_STORAGE_PUBLIC_BUCKETS`, plus defaults `logos`, `og-images`, `article-images`), rejects `..`/absolute paths, and no longer echoes raw storage errors.
- Added server-only `vercel/lib/streamTargetGuard.js`. `stream-proxy`, `stream-transcode`, and `stream-probe` now reject loopback, `0.0.0.0/8`, link-local/cloud-metadata (`169.254/16`), `100.64/10`, multicast, IPv6 loopback/link-local, `localhost`/`*.localhost`/`*.internal`, URL credentials, and hostnames that DNS-resolve to those. LAN ranges (10/8, 172.16/12, 192.168/16) remain allowed on purpose for `10.1.1.1` movie sources. `stream-proxy` follows redirects manually and re-checks each hop; ffmpeg/ffprobe routes check only the initial URL (ffmpeg's own redirects are a residual risk).
- Verified: guard unit check (10.1.1.1/LAN/public allowed; 127.0.0.1, localhost, 169.254.169.254, ::1, 0.0.0.0, localtest.me, decimal-IP, mapped-IPv6, credentials, file:// blocked); `npm run build` succeeded (one Turbopack NFT tracing warning traced via `stream-transcode`, not investigated); local `next start` returned 404 for non-allowlisted bucket and `..` path. Existing `admin_announcements` images all use bucket `webtvbd`, which is allowlisted.
- Observed, not fixed: fetching a real image through `/api/media/object` from S3 (`storage.raishahost.com`) timed out after 25s both locally and on production with the old code.
- Commit `25e8a6b` pushed to `origin/master` (fast-forward from `4078f8e`); code files only, AGENTS.md left uncommitted because it contained prior uncommitted edits.
- Image: built locally with buildx builder `dokploybuilder` for `linux/amd64,linux/arm64` and pushed as `rajibrt/webtvbd:latest` and `rajibrt/webtvbd:25e8a6b`; index digest `sha256:27be3f1cc59963169658a9e8951f168b917f543a0a3252b49139b44c3ce92f3c`. The Docker Hub repo is public: verified the exported arm64 image has no `.env*` file and does not contain the Supabase service-role or object-storage secret values.
- User preference (2026-11-11): build the Docker image locally and push it, rather than having Dokploy build from git, to save server build capacity.
- Dokploy redeploy of `Fullstack`: user reported deploy done on 2026-11-11.
- Production verification after deploy: `/api/media/object` returns 404 for non-allowlisted bucket (`playlists`, `private-stuff`) and `..` path; with the user's logged-in admin session, `stream-proxy` returned 403 for `127.0.0.1`, `localhost`, `169.254.169.254`; `stream-transcode` 403 for `localtest.me`; `stream-probe` 403 for `127.0.0.1`; public HLS test manifest proxied with HTTP 200 and rewritten segment URLs; `stream-probe` for `10.1.1.1` passed the guard and failed only with `Host is unreachable` (existing WireGuard routing issue). Public pages returned 200; `npm run audit:public` re-run: 34 sitemap URLs, 22 articles, 5 redirects, 0 warnings, 0 failures.

### 2026-11-11 - Dashboard load-time fix

- Goal: `/dashboard` took ~10s even for signed-out visitors.
- Findings (measured against production Supabase): `client_activity_events` has ~530k rows and no `created_at`-only index; the 365-day trend query hit the statement timeout (~8s) so the trend chart silently received no event rows; 7-day queries were capped at Supabase's 1,000-row max, truncating 7-day stats; `viewer_activity_events` table does not exist in production (query errors fast). The dashboard page ran its report queries in parallel with the layout's auth redirect, so signed-out visitors waited for them too.
- Files changed: `vercel/lib/dashboardReports.js` (7-day events/history paginated via `fetchAllRows`; raw 365-day fetches replaced by RPC `dashboard_unique_visitors` per bucket with fallback to 7-day rows when the RPC is missing), `vercel/app/dashboard/page.js` (await `requireAdmin()` before data), `vercel/lib/auth.js` (`getCurrentAdmin` wrapped in React `cache`), `vercel/proxy.js` (redirect `/dashboard*` to `/login` when the admin cookie is absent), new `vercel/supabase/dashboard_performance.sql` (indexes on `client_activity_events(created_at)` and `client_recent_history(watched_at)` plus the RPC, service_role only).
- Verified locally against production data: `getDashboardReports()` ~1.0s (previously ~9-10s); standalone build signed-out `/dashboard` 307 to `/login` in ~2ms; logged-in `/dashboard` 0.8-1.1s warm (2.9s first hit). Build succeeded.
- Pending: user must run `vercel/supabase/dashboard_performance.sql` in Supabase SQL Editor (until then the 30-day and 12-month visitor charts only reflect the last 7 days); commit, image build/push, Dokploy redeploy.

### 2026-11-12 - Supabase database size over Free-plan limit; activity-log retention

- Found (Supabase Usage page, read via user's Chrome session): Database Size 545.69 MB vs 0.5 GB Free-plan quota ("Exceeding usage limits"); egress 1.385 GB, other quotas fine. `client_activity_events` held 530,707 rows, 487,103 older than 90 days (`presence_ping` ~279k).
- Backup (verified): full table exported to `backups/client_activity_events-2026-11-11T18-07-25-284Z.ndjson.gz` (530,707 rows, 14 MB, sha256 `393e7f19…87b52d9`) plus `.manifest.json`; `backups/` is excluded via `.git/info/exclude` (contains user data, never commit). Scripts: `vercel/scripts/backup-activity-events.mjs`, `vercel/scripts/restore-activity-events.mjs` (dry run by default, `--apply` to insert, skips existing rows, lowers archive totals). Restore dry run matched 487,103 rows older than 90 days; `--apply` path was not exercised.
- With explicit user approval, ran `vercel/supabase/activity_retention.sql` in the Supabase SQL Editor (user's Chrome): created `client_activity_event_archive_totals`, `prune_client_activity_events(90)`, deleted 487,103 rows (archive totals sum 487,103 across 19 event types), scheduled pg_cron job `prune-client-activity-events` daily 20:30 UTC. Then ran `vacuum full public.client_activity_events`.
- Result (verified via SQL): database size 126 MB; `client_activity_events` 34 MB / 43,621 rows, oldest 2026-08-13.
- Code: `lib/dashboardReports.js` adds archive totals to all-time login/playback-attempt/playback-failure counts; verified totals unchanged (3041 / 102935 / 15946) and 12-month chart now populated; reports ~0.7-1.4s.
- Commit `6a2e229` pushed to `origin/master`; image `rajibrt/webtvbd:latest` + `:6a2e229` pushed (index digest `sha256:5d3d512f87cc75d5378739b0b4880af4dee233776de589f6fbb0078f3325ecce`), verified no `.env*`, no secret values, no backup files in the image. Pending: Dokploy `Fullstack` redeploy and live verification. Supabase usage page may take up to 1 hour to refresh.

### 2026-11-12 - Deployed dashboard speed + retention release (6a2e229)

- User reported Dokploy `Fullstack` redeploy of image `rajibrt/webtvbd:latest` (`6a2e229`, digest `sha256:5d3d512f…`).
- Verified live: signed-out `/dashboard` and `/dashboard/clients` now return 307 to `/login` in ~0.8s (previously 200 after ~10s); logged-in `/dashboard` (user's Chrome admin session) returned full HTML in 2.2-3.6s (previously ~10s); public pages 200; `/api/media/object` non-allowlisted bucket 404; `npm run audit:public` 34 sitemap URLs, 22 articles, 5 redirects, 0 warnings, 0 failures.
- Open follow-ups: S3 `storage.raishahost.com` object fetch via `/api/media/object` timed out (pre-existing); `viewer_activity_events` table missing in production (guest analytics empty); 10.1.1.1 movie source unreachable from Dokploy (WireGuard forwarding on Cudy router); AGENTS.md ledger itself is still uncommitted (contains a prior uncommitted entry).

### 2026-11-12 - Mapped production infrastructure; found real deploy source and MinIO fault

- Goal: diagnose `/api/media/object` image timeouts; user asked that all infrastructure findings be recorded here and kept current.
- Findings (read-only, user's Chrome sessions in Dokploy and Supabase): see the new **Production infrastructure map** section. Key facts:
  - `Fullstack` builds from GitHub `live-channel-tester@master` with Dockerfile and **Autodeploy ON**. Earlier ledger entries (2026-09-27, 2026-11-11, 2026-11-12) that described deploying via `rajibrt/webtvbd:latest` were wrong about what production runs: each push to `master` was built by Dokploy itself (container image `webtvbd-fullstack-itwefz:latest`; exited containers at each push time confirm). The deployed code is still correct because the same commits were pushed to `master`.
  - `storage.raishahost.com` / `media.raishahost.com` belong to MinIO in Dokploy project `ecommerce-dev` (`ecommerce-minio-h1mqpn`). The container is running (restarted 2026-11-10 03:00 Asia/Dhaka) but is attached only to its own compose network, not `dokploy-network`, so Traefik times out. Container logs also show an older 2026-06-20 incident where `/data` went offline briefly and recovered.
  - `webtvbd.com` resolves directly to `46.62.197.37` (no Cloudflare).
- Changes: AGENTS.md only (infrastructure map, start-procedure rule 6, pending item 0). No Dokploy, DNS, or MinIO changes made.
- Pending (needs user approval): redeploy ecommerce-dev `minio` to re-attach `dokploy-network`; optionally add restart policy and external network to its compose; decide deploy model.

### 2026-11-12 - Restored MinIO behind storage.raishahost.com

- With user approval, pressed Deploy (Confirm) on Dokploy ecommerce-dev → `minio` (compose `ecommerce-minio-h1mqpn`); deployment finished "Done".
- Verified: `https://storage.raishahost.com/minio/health/live` 200 (0.8s), `https://storage.raishahost.com/` 403 (expected anonymous S3), `https://media.raishahost.com/` 200; three real announcement images via `https://webtvbd.com/api/media/object?bucket=webtvbd&path=…` returned 200 `image/webp` (67-122 KB, 1.3-1.6s). Previously all timed out.
- Not changed: compose file (no restart policy / external network yet). Infrastructure map "Known open issues" item 1 updated to a recurrence risk with the recommended fix.

### 2026-11-12 - Made MinIO (storage.raishahost.com) survive host restarts

- With user approval in Dokploy ecommerce-dev → `minio`: edited the raw compose to add `restart: unless-stopped`, service networks `default` + `dokploy-network`, top-level `dokploy-network: external: true` (comments kept); Saved ("Compose config Updated"). Preview showed Traefik label still `traefik.docker.network=ecommerce-minio-h1mqpn` because Isolated Deployment was ON (Dokploy marks it deprecated and "breaks on restarts").
- With separate user approval: turned Isolated Deployment OFF (Advanced → Save, "Compose updated"); Preview then showed `traefik.docker.network=dokploy-network`; pressed Deploy → Confirm; deployment "Done". Volume `minio-data` unchanged.
- Verified: container networks `dokploy-network` (10.0.1.24) + `ecommerce-minio-h1mqpn_default`; `storage.raishahost.com/minio/health/live` 200, `media.raishahost.com` 200; two real images via `webtvbd.com/api/media/object` 200 `image/webp` in ~1.3s.
- Rollback if needed: re-enable Isolated Deployment, restore the previous compose (no `restart`/`networks` keys), Deploy.
- Not yet verified: behavior across an actual host restart.

### 2026-11-12 - Audited Isolated Deployment on all Dokploy compose services (read-only)

- Read the Advanced → Isolated Deployment switch (`aria-checked`) and Domains for every compose service across all Dokploy projects; probed each domain with curl.
- ON: Porzobekkhon minio, n8n-with-postgres, Camerabazar-Dedicated minio (remote server 46.224.103.228), camerabazar-prod minio (stopped). OFF: ecommerce-dev minio (changed today), WHMCS puller, RCN rcn-stack. All probed domains returned 200.
- No changes made; recorded in the new **Dokploy compose services audit** table. User decided on 2026-11-12 not to switch the remaining services now ("এখন না"); revisit only if the user asks or one of them fails after a restart.

### 2026-11-12 - Planned isolation-off for remaining compose services (blocked, not applied)

- User approved redeploying the running isolated services (short downtime acceptable, no data loss) so they survive host restarts.
- Findings before change: Porzobekkhon `minio` compose already has `restart: unless-stopped` and external `dokploy-network`; only Isolated Deployment needs turning off. n8n and Camerabazar-Dedicated `minio` not yet inspected.
- The agent's browser action to toggle the switch was denied by the session's permission classifier; nothing was changed (verified the page/switch unchanged). Remaining work, per service: Advanced → turn off "Enable Isolated Deployment" → Save → General → Preview Compose shows `traefik.docker.network=dokploy-network` → Deploy → Confirm → check domain health and `View Networks` includes `dokploy-network`. Order: Porzobekkhon minio, n8n-with-postgres, Camerabazar-Dedicated minio (live Camera Bazar media; do last). Skip the stopped camerabazar-prod minio.

### 2026-11-12 - Turned off Isolated Deployment on all running compose services

- User approved short redeploy downtime (no data loss). After the user granted the browser permission, for each service: checked compose (restart policy present), Advanced → Isolated Deployment OFF → Save ("Compose updated"), Preview Compose showed `traefik.docker.network=dokploy-network`, Deploy → Confirm → "Done".
  - Porzobekkhon `minio`: compose already had `restart: unless-stopped` + external `dokploy-network`. Verified `s3.porzobekkhon.net/minio/health/live` 200, `media.porzobekkhon.net` 200.
  - n8n `n8n-with-postgres`: both services `restart: unless-stopped`; after change n8n on `dokploy-network` + `default`, postgres on `default` (n8n reaches DB host `postgres`); volumes `n8n_data`/`postgres_data` unchanged. Verified `/healthz` and `/healthz/readiness` `{"status":"ok"}` 200.
  - Camerabazar-Dedicated `minio` (remote server): `restart: unless-stopped`, ports 9000/9001. Verified `storage.camerabazar.net/minio/health/live` 200, `media.camerabazar.net` 200, a live camerabazar.net homepage image from `storage.camerabazar.net/cbmedia/...` 200 `image/webp`.
- Final sweep: storage/media.raishahost.com, s3/media.porzobekkhon.net, storage/media.camerabazar.net, n8n readiness, webtvbd.com, camerabazar.net all 200.
- Not changed: stopped camerabazar-prod `minio`. Not verified: behavior across a real host restart (check the health URLs after the next one). Container network membership was verified directly only for ecommerce-dev minio; for the others it is implied by Traefik routing succeeding with `traefik.docker.network=dokploy-network`.

### 2026-11-12 - Channel multi-source failover, Phase 1 (local, not deployed)

- User rule (2026-11-12): show every admin/client change locally and deploy only after approval. Other local dev servers/containers were stopped at the user's request; this project runs alone via `cd vercel && npm run dev -- --hostname 127.0.0.1 --port 3010 --webpack`.
- SQL applied in production Supabase with user approval: `vercel/supabase/channel_sources.sql` → table `channel_sources` (2,369 rows backfilled = every channel's current `stream_url`, label `primary`), RPC `record_channel_source_result` (service_role only). Verified anon cannot read the table or call the RPC.
- Code (uncommitted): `components/iptv/homeData.js` (paginated links — previously capped at 1,000 of 1,161 rows; chunked channel lookup; attaches ordered `sources[]`), `components/iptv/VideoPlayer.js` (tries sources in order; failover on 12s startup timeout, fatal error, or 15s stall when alternates exist; hls `recoverMediaError`; "বিকল্প লিংকে চেষ্টা হচ্ছে (n/N)" status; Bengali all-failed message + "আবার চেষ্টা করুন"; remembers the working link per device in localStorage; dev-only test switch localStorage `webtvbd:dev-break-first-source=1`), `components/iptv/IptvHomeClient.js` (`playback_started` events), `app/api/visitor/activity` + `app/api/client/activity` (new events `playback_started`, `movie_audio_unsupported`; per-source counters via `lib/channelSourceStats.js`, recorded once in the visitor route), `app/api/admin/channels/[id]/sources/route.js` (GET/PUT ordered links; PUT keeps `channels.stream_url` = first active link), `app/api/admin/playlists/[slug]/editor-save` (a main link edited in the table is added as the first source), `app/dashboard/playlists/[slug]/ChannelSourcesDialog.js(+.module.css)` and a "লিংক" button next to Preview in `playlist-editor.js`. `npm run build` passed.
- Caution while testing locally: local admin saves write to the production DB, and the deployed (old) site still reads `channels.stream_url`, so keep a working link first when editing real channels.
- Not yet verified in a browser: the admin dialog UI and client failover (both need the user's own login on 127.0.0.1:3010). API checks passed: GET sources 200 with admin session, 401 without.

### 2026-11-12 - Links button fix, English admin text, redesign request

- Bug: the new Links button was invisible because `.editorTable .colPreview` was fixed at 78px; widened to 150px. The button now shows the link count via new `POST /api/admin/channels/source-counts` and is highlighted when a channel has more than one active link. `/dashboard/playlists?selected=<slug>` and `/dashboard/playlists/<slug>` both render the same `playlist-editor.js`.
- User rule: admin dashboard text must be English (client site may be Bengali). Converted the Links button and `ChannelSourcesDialog` to English. Verified in the user's Chrome on 127.0.0.1:3010: dialog opens, shows the link with viewer stats.
- User request: separate channel groups and channel links into different pages and simplify/redesign the admin playlist UI. Proposal sent (playlist overview + per-playlist tabs Channels / Groups / Health / Settings, channel side drawer with Details / Links / Test, immediate per-action saves instead of the global "Save updates" counter). Awaiting approval. Nothing committed or deployed.

### 2026-11-12 - Admin playlist redesign, steps 1-2 (local, not deployed)

- User approved the redesign. Implemented (uncommitted), English UI:
  - `/dashboard/playlists` → playlist cards (`PlaylistCards.js`: channels/live/dead/groups, Open, Copy M3U link, "New playlist" modal posting to `/api/admin/playlists`). Old `?selected=<slug>` links redirect to `/dashboard/playlists/<slug>`.
  - `/dashboard/playlists/<slug>` → new workspace (`[slug]/workspace/PlaylistWorkspace.js`) with tabs Channels / Groups / Health / Settings (`?tab=`). Groups/Health/Settings are placeholders pointing to the classic editor until the next steps.
  - Channels tab (`ChannelsTab.js`): group sidebar with counts and dead badges, search, filters (live/dead/hidden/has backup links), compact rows (order ↑↓ within a group, logo, name+host, status, link count, Home toggle, Edit), bulk bar (move group, show/hide home, mark live/dead, remove), "Show more" paging (200).
  - Channel drawer (`ChannelDrawer.js`): Details (name, group, logo URL/upload, show on home), Links (`ChannelSourcesPanel`, refactored out of `ChannelSourcesDialog.js`), Test (in-browser player per link). "Add channel" uses the drawer and then opens Links.
  - Classic editor preserved at `/dashboard/playlists/<slug>/classic`.
  - New APIs: `PATCH /api/admin/channels/[id]`, `POST /api/admin/playlists/[slug]/channels-bulk`, `POST /api/admin/playlists/[slug]/channel-order`; helpers `lib/playlistAdminData.js`, `lib/playlistGroups.js`. Bulk remove/live/dead reuse `health-actions`.
- Verified in the user's Chrome on 127.0.0.1:3010 (read-only): cards render (bdix 1144/1105/39/47; OnTest 17/12/5/2), workspace + Channels tab render, drawer Details/Links/Test work (Test played Ananda TV's link). Fixed card stretching and clipped group counts. New APIs return 401 without admin session. Saving actions (PATCH, bulk, reorder, add) were not exercised because they write to production data.
- Next: Groups tab, Health tab, Settings tab; then user review, then commit/deploy.

### 2026-11-12 - Found 37 fake "paused" channel links; queued CSV import task

- User asked to delete links that always show "Stream temporarily paused". Verified all 37 `cdn.devm3u.top` links in `bdix` are VOD playlists with one 15s segment pointing to the same slate file (`cdn.jsdelivr.net/gh/zisanongit/live247/.../segment_00000.ts`), yet marked LIVE. 30 have working copies under other names (e.g. "Ananda TV" → "Ananda TV 2"); 7 have none (Channel One, Time TV, Dhoom Music, Sun Bangla HD, BALLE BALLE, MOVIE BANGLA, Rupshi Bangla); 1 client favorite references one of them.
- Backup before any change: `backups/channels-devm3u-paused-2026-11-12.json` (37 channels, 37 playlist links, 37 sources, 1 favorite). Awaiting the user's choice (delete all 37 or only the 30 with copies). Nothing deleted yet.
- Queued pending item C (CSV import from the WalaTV traffic capture) to run after current work.

### 2026-11-12 - Removed the 37 fake "paused" cdn.devm3u.top channels

- With the user's explicit approval ("৩৭টাই মোছো"): removed the 37 channels from `bdix` (playlist_channels) and deleted their now-orphan channel rows (cascade removed their 37 channel_sources rows). Safety check before delete: all 37 still had a `cdn.devm3u.top` stream_url.
- Verified: 0 `cdn.devm3u.top` channels/sources remain; bdix now has 1,107 channels (was 1,144); working copies such as "Ananda TV 2", "Jamuna TV", "ZEE BANGLA", "Asian TV" still exist. Backup for restore: `backups/channels-devm3u-paused-2026-11-12.json`. One client favorite still references a deleted id (left untouched).
- Lost entirely (no other copy): Channel One, Time TV, Dhoom Music, Sun Bangla HD, BALLE BALLE, MOVIE BANGLA, Rupshi Bangla — candidates to re-add from pending item C.

### 2026-11-12 - Admin playlist redesign, steps 3-4 (local, not deployed)

- Implemented (uncommitted), English UI:
  - Groups tab (`workspace/GroupsTab.js`, API `POST /api/admin/playlists/[slug]/groups` with actions reorder/add/rename/delete): ↑↓ order (saved immediately), Sort A–Z, add, inline rename (updates `channels.category` for this playlist's channels + `playlist_groups` row; merges into an existing group of the same name), delete with mandatory "move channels to" when non-empty. Clicking a group name opens it in the Channels tab.
  - Health tab (`workspace/HealthTab.js`, API `GET /api/admin/playlists/[slug]/health` summing `channel_sources` viewer counters per channel): stats (live, dead, failing for viewers, only one link), "Failing for viewers" list (≥3 failures and failures ≥ plays), dead-channel list with Edit / Mark live / Remove and bulk Mark all live / Remove all dead, link to the existing live-check page. Uses the same channel drawer.
  - Settings tab (`workspace/SettingsTab.js`): rename (existing `/api/admin/playlists/rename`, navigates to the new slug), public M3U link copy + "Create new link" (existing `/api/admin/tokens`, warns the old link stops working), delete playlist with typed-slug confirmation (existing `/api/admin/playlists/delete`; keeps channel rows).
- Verified in the user's Chrome on 127.0.0.1:3010 (read-only): all four tabs render; Groups header alignment fixed; Health shows 1,068 live / 39 dead / 0 failing / 13 channels with viewer reports. Write actions were not exercised (production data). The local M3U link shows `localhost:3000` because of the local `PUBLIC_PLAYLIST_BASE_URL`.
- Remaining before deploy: user review of the full redesign (plus Phase 1 failover and movie notice), then commit/push (Dokploy autodeploys). Later cleanup: dashboard shell title still says "Playlist Editor"; sidebar "Add New Channel" and "Local Check" pages could be folded into the workspace.

### 2026-11-12 - Deployed 2875a02 (failover, admin redesign, movie notice)

- User approved deployment. Production build passed locally; commit `2875a02` (41 files) fast-forwarded to `origin/master`; Dokploy Autodeploy built it ("Running" with hash 2875a02 seen in Fullstack → Deployments). New route `/api/admin/playlists/bdix/health` switched from 404 to 401 about 30s after the poll started.
- Verified live: public pages 200, `/dashboard*` 307 to login when signed out, new admin APIs 401 without session, `playback_started` visitor event 200, `npm run audit:public` 34/22/5/0/0; in the user's Chrome the new `/dashboard/playlists/bdix` workspace renders (1,107 channels, 47 groups).
- Not yet active in production: `movie_source_media_info` (SQL not run, scan not run) — the movie notice still works via runtime detection. Pending: item C (CSV import + category cleanup + dead removal + wrong-category moves), movie codec scan, failover Phases 2-3.
- Local dev server restarted on 127.0.0.1:3010 after a clean `.next`.

### 2026-11-12 - Category order fix + cleanup analysis (local, not deployed)

- User reported categories could not be reordered as before. Root cause: viewer home data ordered categories by playlist link traversal, ignoring `playlist_groups`; the classic editor rewrote channel positions, the new Groups tab only saved `playlist_groups`. Fix (uncommitted): `components/iptv/homeData.js` sorts categories by saved `playlist_groups` position (fallback traversal); Groups tab gets drag-and-drop rows, a "Top" button; Channels sidebar gets a "Reorder" link to the Groups tab. Verified rendering locally.
- Cleanup analysis (read-only, from the user's Mac on the ISP network): probed all 1,107 bdix links → 604 ok, 154 gone (404/no segments/slate), 285 unreachable (timeouts/DNS; may work on other ISPs — e.g. all 90 in "NEW SERVER ✔️" on 103.229.254.25:7001), 64 blocked (403/401). Of the 39 DB-DEAD channels: 4 gone, 1 actually plays. Per-channel results: `backups/imports/bdix-link-test-2026-11-12.csv`. Probe script kept in the session scratchpad (`cleanup/probe.mjs`).
- CSV capture: 32 distinct streams after de-duplicating variants; 29 play. Identified by URL or frame grab: Somoy TV, RTV HD, SATV, Bangla TV, Global TV, News21, Movie Bangla TV, Probashi TV, Matribhumi, TBN24, Khushboo Bangla, beIN Sports 1/2/3, Willow Extra, ESPN, ESPN 2, Fox Sports 1, NBA (USA_NBA), Eurosport, LaLiga (mcquack 235), Kanal 1 Sport / Kanal 1 Extra (Slovak), Sky Sports Cricket (megatv 7343). Not channels/unusable: mcquack 234 (IPTV menu), 45.5.118 a08x ("Sin acceso"), 92.114.85.87 a00e/a00f (segment timeouts), bosstv (429). Two jagobd tokenized links gave no frame (to recheck).
- Proposal sent to the user (taxonomy merge, removal policy, CSV mapping); nothing written to the DB yet.

### 2026-11-12 - Per-channel cleanup plan prepared (not applied)

- Generated (read-only) `backups/imports/bdix-category-plan-2026-11-12.csv` (every bdix channel: old → new category, how decided, link test, action) and `backups/imports/csv-additions-plan-2026-11-12.csv` (24 CSV streams: 13 backup links incl. 6 placed first where the current link fails here, 11 new channels). Classifier: session scratchpad `cleanup/classify.py` (regex rules + ~400 manual overrides).
- Proposed 16 categories in viewer order: Bangla 85, Bangla News 43, Indian Bangla 54, Hindi 140, Indian Regional 112 (new; Tamil/Telugu/Kannada/Malayalam/Marathi/Gujarati/Punjabi/Odia/NE), English News 48, English Movies 32, Entertainment 15, Sports 162, Kids 40, Music 51, Documentary 52, Religious 58, International 45, Thailand 11 (only real Thai channels), Radio 3.
- Actions: remove 153 dead (gone) + 3 broken rows (#EXTVLCOPT / user-agent text as names), mark 1 live (Ekushey TV 480p), rename 3 rows whose names were image URLs (ENTER 10 BANGLA 2, Sony Sab, Zee Action). Unreachable/blocked links (349) kept pending 7 days of viewer failover data.
- Awaiting user approval; apply will take a full backup first.

### 2026-11-12 - Applied bdix cleanup and CSV import (production data)

- User approved ("হ্যাঁ, প্রয়োগ করো"). Full backup first: `backups/bdix-full-before-cleanup-2026-11-12.json` (1,107 bdix links, 1,107 channels, 1,107 channel_sources, 47 playlist_groups, 17 links of other playlists).
- Removed 156 channels from bdix (153 dead + 3 broken rows); 155 orphan channel rows deleted, 1 kept because OnTest also uses it. Renamed id 283 → "ENTER 10 BANGLA 2" (the other two broken-name rows were dead and removed). Marked "Ekushey TV (480p)" LIVE.
- Category updates on 676 channels; bdix `playlist_groups` replaced with 16 groups in order: Bangla, Bangla News, Indian Bangla, Hindi, Indian Regional, English News, English Movies, Entertainment, Sports, Kids, Music, Documentary, Religious, International, Thailand, Radio.
- CSV import (label `WalaTV` on channel_sources): backup links added to Somoy TV, RTV, SATV, Bangla TV, Probashi TV, Khushboo Bangla (appended) and placed first for GLOBAL TV HD 1 (priority -1; `channels.stream_url` unchanged because the URL is the primary of orphan channel 353 "GLOBAL TV HD"), Bein Sport 1, Bein Sport 2, FOX Sports, Eurosport HD, Euro Sport 2 HD, Sky sports cricket (these became primary). Skipped as already present: News 21, TBN 24, Movie Bangla (existing "মুভি বাংলা" id 20 uses the same URL). New channels with logos from iptv-org: Matribhumi TV 2577, beIN Sports 3 2578, Willow Extra 2579, ESPN 2580, ESPN 2 2581, NBA TV 2582, LaLiga TV 2583; without logo: Kanal 1 Sport 2584, Kanal 1 Extra 2585.
- Verified: bdix now 960 channels, all in the 16 groups (Bangla 85, Bangla News 43, Indian Bangla 55, Hindi 140, Indian Regional 112, English News 48, English Movies 32, Entertainment 15, Sports 169, Kids 40, Music 51, Documentary 52, Religious 58, International 46, Thailand 11, Radio 3); 34 still DEAD (hidden); 646 without logo. Live admin workspace shows 960 channels / 16 groups.
- Viewer-side category order follows `playlist_groups` only after the local homeData fix is deployed (still uncommitted together with Groups drag-and-drop).
