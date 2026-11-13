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

## Playlist / channel-link import (skill — read first)

When the user gives a playlist, M3U, traffic capture or link list and says "add it", "যুক্ত করো", "অ্যাড করো" or similar, every agent (Claude, Gemini, ChatGPT, …) must first read and follow `.claude/skills/playlist-import/SKILL.md` (Claude Code loads it as the `playlist-import` skill). It holds the user's rules (trace real links, backup links for existing channels, dead links to the bottom, reject audio-only/black/no-signal links, delete or mark DEAD channels without a working link, review before writing, final summary format), the data model and the scripts in `vercel/scripts/channel-import/`. Today it covers TV channels; radio stations and movie lists are to be handled the same way next. When the user changes any of these instructions, update that SKILL.md (and its change log) in the same task.

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
6. `/watch/<id>` HTML was ~11 MB because the whole movie catalog was sent with every channel page. Fixed 2026-11-12 in `37b6392`: the catalog is sent only for `?mode=movies`; otherwise the client loads it from `/api/client/movies/bootstrap` when the viewer opens Movies.

## Current external handoff

### Google AdSense

- **Status 2026-11-13 (verified in AdSense + Gmail, supersedes the review notes below):** the 2026-08-04 review was rejected on 2026-08-14 ("You need to fix some issues before your site is ready for AdSense"; earlier identical rejections 2026-03-29 and 2026-04-20). On 2026-09-02 the account pub-3010934061489506 was reset for inactivity. AdSense now shows only "Your AdSense account was deactivated because it's inactive" with a **Reactivate account** button (phone verification + site review); Sites and Policy Center pages redirect to that screen, so the specific site issues cannot be read until it is reactivated. Not clicked (needs the user).
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
   2. Codec catalog — code deployed in `2875a02`, NOT yet active: `vercel/supabase/movie_media_info.sql` (table `movie_source_media_info`, keyed by source_url) + `vercel/scripts/scan-movie-media-info.mjs` (ffprobe, must run on a machine inside the ISP network, e.g. the user's Mac). `lib/moviesData.js` attaches `source.audioCodecs/browserAudioOk/reachable` when the table exists. DONE 2026-11-12: SQL applied and scan finished (4,038 URLs; 1,083 = 27% without browser-playable audio). The notice now uses this data.
   3. DECIDED 2026-11-12 (user: "Keep notice for now"): keep the VLC/Edge/Safari notice; in-browser transcode is not feasible (no CORS on the FTP hosts). Revisit only if the user asks. Original note: decide between an ISP-local transcode gateway (existing `vercel/transcode-gateway`, Cloudflare Tunnel) or in-browser audio transcode. Also use the scan's `unreachable` rows to deactivate dead movie links.
B. **TV channel multi-source failover (requested 2026-11-12; Phase 1 DEPLOYED in `2875a02` on 2026-11-12; Phases 2-3 pending):**
   - Current facts: `channels` has one `stream_url` (UNIQUE, used as import/dedupe key); `playlist_channels` links; `playlist_groups` = per-playlist category order; status LIVE/DEAD set by a server cron that cannot reach ISP-local hosts; `components/iptv/VideoPlayer.js` (1544 lines) has no retry/alternate URL; home data `components/iptv/homeData.js` cached 60s, no paging; admin channel management spread over ~10 files / ~5.7k lines (`playlist-editor.js` 2167, `live-check-workspace.js` 1431). Admins currently add duplicates like "Ananda TV" / "Ananda TV 2" as a workaround.
   - Phase 1: table `channel_sources` (channel_id, stream_url, label/collection, priority, is_active, last_status, counters), backfill from `channels.stream_url`, keep `channels.stream_url` = top source for compatibility; home data sends ordered `sources[]`; player auto-failover (startup timeout, fatal error, long stall) with a small non-blocking "trying alternate link n/N" indicator, remembers the working source per device, reports per-source success/failure; admin "Channel sources" drawer (add/reorder/test/disable links).
   - Phase 2: "merge duplicates" tool (suggest by normalized name, keep one channel id, map favorites/history of merged ids), import a collection M3U as extra sources of existing channels instead of "Name 2" copies.
   - Phase 3: ISP-aware ranking from viewer reports (client IP → ASN/ISP), per-source/collection health dashboard, stop server-side marking of ISP-local sources as DEAD, simplify/merge editor + live-check UIs.
   - Keep `channels.id` stable (favorites, history, `/watch/{id}-slug`, analytics).
C. **Import channels from the user's traffic capture — APPLIED 2026-11-12 (see ledger); follow-ups: 130 linked channels still without a logo after round 3, 7-day review of unreachable links (~2026-11-19):**
   - Source file: `/Users/Kayum_1/Downloads/CSV_2026-11-11_23-07-12.csv` (copied to git-excluded `backups/imports/CSV_2026-11-11_23-07-12.csv`). It is an HTTP traffic log from the "WalaTV" app, not an M3U: 520 requests, ~53 unique `.m3u8` URLs (hosts such as `116.204.149.16`, `alvetv.com`, `app24.jagobd.com.bd`, `tvsen6.aynaott.com`, `85.237.89.160:9590`, `27.124.71.27`) and ~57 logo/image requests (`images.weserv.nl`, `i.imgur.com`, `trendnestbd.com`).
   - Task: extract the stream links (prefer master `index.m3u8` over `tracks-*/mono.m3u8` variants), play-test each from the ISP network, identify the channel (Bangladeshi / Indian / other), then add it to the right channel and group — as a backup link (`channel_sources`) when the channel already exists, otherwise as a new channel. Set an appropriate logo only when the channel has none. Present the mapping to the user before writing, and follow the local-review rule.
   - Extended scope (user, 2026-11-12), same task: reduce the number of categories (merge unnecessary/duplicate groups such as "SPORTS CHANNELS" vs "Sports", "INDIAN CHANNELS" vs "India"/"Indian Bangla"), remove dead channels that no longer play, and move channels sitting in the wrong category to the right one. Propose the new category list and the moves to the user before applying. Local and production share one Supabase DB, so data changes are live immediately (no deploy needed).
D. **More backup links for Bangladeshi channels (requested 2026-11-12; plan proposed, not started):** most channels have one link. Plan: (1) collector script on the user's Mac (ISP network) reading public lists (iptv-org bd/bangla M3U), user-supplied M3U/captures and ISP/BDIX portal lists; match to our channels by normalized name + alias table; (2) probe from the ISP network (manifest, segment, frame grab to confirm identity, startup time, resolution); (3) review sheet → user approves → add as `channel_sources` with a collection label and quality-based priority; (4) admin "Import collection" (paste/upload M3U → match preview → approve); (5) scheduled re-probe, auto-deactivate dead links, then Phase 3 ISP-aware ranking; (6) consider official YouTube live as a source type. Target: every Bangla/Bangla News channel ≥2 working links. Licensing: prefer official/free streams; tokenized links from commercial apps expire and may breach their terms.
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

### 2026-11-12 - Deployed 4dfde43; filled channel logos

- Commit `4dfde43` (viewer category order follows `playlist_groups`, Groups drag-and-drop/Top, Channels "Reorder" link, ledger) pushed to `origin/master`; Dokploy autodeploy "Done" (44s). Verified live: public pages 200, `/dashboard` 307, audit 0 warnings/0 failures; live admin shows the "Reorder" link and new logos.
- Logos (user request): backup `backups/channel-logos-before-2026-11-12.json` (all 2,186 channel logo values). Matched only channels linked to a playlist and with an empty logo: 123 from same-name siblings in our DB (trailing copy numbers ignored except for numbered series such as Star Sports/TEN/Sony/beIN), 266 from iptv-org (`iptv-org.github.io/api` channels+logos; main name exact match only, country must fit the category — alt-name matching was dropped after France 24 → France 2 and similar errors). Applied 389 with a guard that only writes when logo_url is empty. Match list: `backups/imports/logo-matches-2026-11-12.json`. 258 linked channels remain without a logo (generic names like "Channel 155"/"ENC 7016", no confident match). Script: session scratchpad `cleanup/logos.py`.
- Local dev server restarted on 127.0.0.1:3010.

### 2026-11-12 - Movie codec scan started; English default on both sites (local, not deployed)

- Ran `vercel/supabase/movie_media_info.sql` in the Supabase SQL Editor (user's Chrome): "Success. No rows returned" → table `movie_source_media_info` exists in production.
- Started `node --env-file=.env.local scripts/scan-movie-media-info.mjs --concurrency=6` from the user's Mac (ISP network). Interim at 1,500 URLs: 1,485 ok, 6 unreachable, 9 error; 176 with browser-unsupported audio (ac3 107, eac3 64, dts 6, plus mixed). aac 1,238, mp3 65, opus 21. Scan still running; final numbers pending.
- User rule (2026-11-12): admin and client sites both default to English. Changed (uncommitted): `lib/i18n/dictionaries.js` `DEFAULT_LOCALE` "bn" → "en" and new `player.*` keys (en + bn); `components/iptv/VideoPlayer.js` and `components/movies/MoviePlayer.js` use `useI18n` instead of hardcoded Bengali; `IptvHomeClient.js` cookie-banner language defaults to en (bn only when saved); `TopNavbar.js` push-dialog default en. Explicit `site_lang` cookie choices are kept.
- Verified locally (127.0.0.1:3010, no cookie): `/`, `/articles`, `/watch`, `/client-login`, `/about` serve `<html lang="en">` with English UI; eslint clean. Article bodies stay Bengali (written in Bengali; `articleLocalization.js` only translates en→bn). Not deployed.

### 2026-11-12 - Channel A–Z / Z–A sort per group; deployed with English default

- User request: channels inside a group could be sorted A–Z before; restore it. `workspace/ChannelsTab.js` now shows "A–Z" and "Z–A" buttons when one group is selected (no search/status filter). After a confirm, it sorts the whole group by name (natural order) and saves through the existing `channel-order` API (reuses the group's position slots). The viewer site orders by `playlist_channels.position`, so it follows.
- Verified locally in the user's Chrome: buttons render in the Indian Bangla group. Not clicked (it would change production order).
- Correction: the earlier note "eslint clean" was wrong; the project has no eslint config. `npm run build` passed.
- Deployed together with the English-default change in the same commit (user: "এটা করে তারপরে ডিপ্লয় করো").

### 2026-11-12 - Movie codec scan finished

- `scan-movie-media-info.mjs` finished from the user's Mac: 4,038 non-HLS movie URLs, 4,013 ok, 11 unreachable (10.1.1.1 ×5, cdn1.discoveryftp.net ×5, 172.16.50.14 ×1), 14 error (discoveryftp). Rows are in `movie_source_media_info`.
- 1,083 ok files (27%) have no browser-playable audio: ac3 646, eac3 382, eac3+ac3 21, dts 21, plus a few truehd/wmav2. aac 2,569, mp3 262, opus 38 are fine. 22 files have eac3+aac (a playable second track the player could select).
- Effect: `lib/moviesData.js` now attaches `browserAudioOk=false` for these sources, so the movie player shows the "open in VLC / Edge / Safari" notice up front.
- Next decision for the user: real fix for ~27% of movies (ISP-local transcode gateway vs in-browser audio transcode); deactivate the 25 unreachable/error links (ask first).

### 2026-11-12 - In-browser AC3 fix investigated: not feasible

- User chose "Try in-browser fix". Checked feasibility first (no code written).
- Blocker: browser JS (ffmpeg.wasm / WASM AC3 decoder) must read the file bytes with `fetch`, which needs CORS. `cdn1.discoveryftp.net` (≈97% of the 1,083 bad-audio files) returns 206 for Range but no `Access-Control-Allow-Origin`, and OPTIONS preflight → 405. `172.16.50.7` has no CORS and no HTTPS. So a page on webtvbd.com cannot read these files; only a `<video>` element can play them, and Chrome cannot decode AC3 there. Web Audio on a non-CORS media element outputs silence.
- `video.audioTracks` (to pick the AAC track in the 22 eac3+aac files) works only in Safari, not Chrome.
- Remaining real options: an ISP-local gateway (e.g. `vercel/transcode-gateway` on a machine inside the ISP: fetch → copy video, AC3→AAC audio → serve with CORS/HTTPS via Cloudflare Tunnel; limited by that machine's upload bandwidth), or ask the FTP operator to add CORS. Current mitigation (VLC/Edge/Safari notice driven by the scan) stays.

### 2026-11-12 - Decision: keep the movie audio notice

- User chose "Keep notice for now". No ISP gateway work planned. The 25 unreachable/error movie links are still active (not asked to deactivate).

### 2026-11-12 - Deactivated dead movie links

- User approved closing the 25 scan failures. Re-probed the 14 "error" rows one at a time: 9 play fine (scan errors were connection drops at concurrency 6), so they were left active (The Holy Man, Kartabya, Krishnakanter Will, Bar Asbe Ekhuni, Tintorettor Jishu, Sedin Dekha Hoyechilo, Dharasnan, Biwi No.1, Naaraaz). Also left active: Mumbai Central (corruption only deep in the file) and The Good Maharaja (AV1 decode warning).
- Deactivated 14 `movie_sources` rows: 11 × HTTP 404 plus 3 corrupt files (Abhimanyu: no moov atom; Shajarur Kanta and Gaslight: invalid start). Each movie had only that one source, so those 14 movies were also set `is_published=false` (hidden from the site and the M3U VOD list): En kärlekshistoria, Bombay, Nikaah, Pakeezah, Roja, Abhimanyu, Shajarur Kanta, Projapati 2, Shiddat, Gaslight, Assi, O' Romeo, Vadh 2, Dhurandhar.
- Backup and undo data: `backups/movie-sources-bad-links-2026-11-12.json` (`applied.deactivatedSourceIds`, `applied.unpublishedMovies` with their previous `is_published`).
- TiviMate question (user): the public M3U (`app/playlist/[token]/route.js`) writes only `channels.stream_url` per channel, so backup links and failover do not reach TiviMate today. Not changed; options proposed to the user.

### 2026-11-12 - Smart redirect links for TiviMate / M3U (local, not deployed)

- User chose "Smart redirect link" so backup links help IPTV apps too.
- New `vercel/app/playlist/[token]/live/[channel]/route.js`: validates the playlist token and that the channel is in that playlist, then 302s to the best active `channel_sources` link (`lib/channelSourcePick.js`: admin order, links that viewers recently reported failing moved to the back — ≥3 failures, latest event a failure, under 6 h old). Deterministic, with token/channel results cached in memory for 60 s/30 s, because players re-request the URL on every live playlist refresh. No server-side probing (Hetzner can't reach BDIX hosts).
- `app/playlist/[token]/route.js`: channels with ≥2 active links get `<origin>/playlist/<token>/live/<id>` (origin from x-forwarded-host/proto); single-link channels keep their direct URL.
- Verified locally: the user's playlist → 927 channels, 13 with smart links (an earlier note said 148; that count wrongly included source URLs containing /live/); redirect 302 to the top link; ffprobe follows it and sees audio+video; bad token / channel not in playlist → 404; selection unit check 7/7.
- Caveats: TiviMate does not switch links mid-stream on its own; it gets a better link on the next open once website viewers have reported the failing one. Those 13 channels now depend on webtvbd.com being up.

### 2026-11-12 - Deployed smart M3U links (260180b)

- Pushed `260180b` to master; Dokploy autodeploy live after ~60 s. Verified: live M3U (www redirects to non-www) has 927 channels, 13 using `https://webtvbd.com/playlist/<token>/live/<id>`; that URL 302s and ffprobe reads audio+video through it; `/` 200, `/watch` 200, `/dashboard` 307.
- Pending: user will refresh the playlist in TiviMate and test on 2026-11-13 (reported plan).

### 2026-11-12 - Channel logos, round 2

- User asked to fill the remaining logos. Re-matched the 258 playlist-linked channels with an empty logo using better name cleanup (price suffixes "- Rs x", emoji, "(1080p)", "_HD", "ENC nnnn", trailing copy digit), same-name siblings in our DB, iptv-org main/alt names with a country check for BD/IN/TH categories, and a hand-checked alias list (e.g. TEN 1/2/3/5 → SonySportsTen*.in, SET → SonyEntertainmentTelevision.in, DW, NDTV, CGTN, RT, Eurosport 1/2 Polska, Viasat, JTBC Golf).
- Dropped by review: [MM] Light (matched a Ukrainian channel), Star Sports (generic), Star Sports Select 2 (would get the Select 1 logo), Azan TV (uncertain).
- Of 111 matches, only the 85 whose URL returned HTTP 200 with image bytes were applied (imgur timeouts, roarzone DNS failure, wikia 403, dead 404s skipped). Written only where `logo_url` was still empty. Backup: `backups/channel-logos-round2-before-2026-11-12.json`. Script: session scratchpad `logos2/`.
- Result (verified): 173 linked channels without a logo (was 258). Remaining are mostly generic names ("Channel 155", "ENC 7014", "EN", "HI") or brands with no confident logo source.

### 2026-11-12 - Identified generic-name channels by frame grab; renamed + logos

- User asked to play the unnamed channels and fix their names and logos. 74 playlist-linked channels with generic names ("Channel 155", "ENC 7014", "Sport 2", "EN", "Ani"…): frame grabs from the user's Mac (ffmpeg, 8 parallel) → 56 frames, 18 failed (timeouts/no video).
- Identified from on-screen logos and renamed 43 (guarded on the old name), each with an iptv-org logo that was checked to load (guarded on empty logo): Khushboo Bangla, Goldmines Bollywood/Movies/Action, Manoranjan TV/Prime/Grand/Movies, B4U Music/Bhojpuri, Anmol TV, Anmol Cinema, Anmol Cinema 2, Rang, Shemaroo TV/Josh/MarathiBana, Channel WIN, Sangeet Bhojpuri, Al Sunnah Al Nabawiyah TV (+ "TV 2"), Kappa TV, A Spor, PTC Punjabi/Punjabi Gold/Music, Epic Music, Epic Bharat, RPlus Gold, All Time Movies, Ekushey TV (was "ETV TV"), Big Magic, E24, Dangal, Dangal 2, Food Food, Music India, Balle Balle, Pitaara, TRT World, 9X Tashan, 9X Jalwa, Fakt Marathi. Backup: `backups/channel-renames-logos-2026-11-12.json`.
- Dead (OTTCLUB "Неверный ключ"/"Канал недоступен" slate), left untouched: 742 Sport 2, 743 Sport 3 HD, 744 Sport 4, 745 Sport 5 HD, 2054 Ani, 2056 Na!oc, 2118 be3.
- Not identified (logo unclear or ad on screen): 991, 1101, 2005, 2012, 2014, 2036; plus 18 with no frame.
- Several renamed channels now duplicate existing ones (e.g. Khushboo Bangla, Ekushey TV, 9X Tashan, Dangal): candidates for failover Phase 2 "merge duplicates" (keep one channel, move the other link in as a backup).
- Result: 130 linked channels without a logo (was 173).

### 2026-11-12 - Removed 7 dead OTTCLUB channels

- User approved ("Yes, remove them"). Removed from `bdix` and deleted (their only playlist; channel_sources cascaded): 742 Sport 2, 743 Sport 3 HD, 744 Sport 4, 745 Sport 5 HD, 2054 Ani, 2056 Na!oc (all `ott.watch`), 2118 be3 (`4.team.ga`). Each showed an OTTCLUB "invalid key"/"channel unavailable" slate.
- Backup: `backups/channels-dead-ottclub-2026-11-12.json` (channels, playlist links, sources). Verified 0 remain. Client favorites pointing at these ids were left as is.

### 2026-11-12 - Merged duplicate channels (failover Phase 2, first pass)

- User asked to merge duplicates. Grouped playlist-linked channels by normalized name (price/resolution/HD/ENC/emoji stripped; trailing copy digit stripped except for numbered series). Excluded on review: ESPN vs ESPN 2, Sansad TV 1/2, ThePapare 1/2, and the bad "news" group (News 1 Thailand / News 21 / News 24); News 24 + NEWS24 HD merged separately.
- 108 groups, 155 channels merged into 108 kept channels (keeper = LIVE, has logo, best viewer success, lowest id). Per group: merged channels' links appended to the keeper's `channel_sources` (label `merged: <old name>`, inactive if the merged channel was DEAD), keeper added to any playlist only a merged channel was in (5), `client_favorites` moved (150) or dropped where the user already had the keeper (43), `client_recent_history` remapped (6,202 rows), keeper renamed to a clean name (e.g. "Somoy TV", "&TV HD", "Jamuna TV") and category fixed for Kappa TV/Khushboo Bangla/Ekushey TV/TRT World, merged channel rows deleted.
- Old→new id map stored in `admin_settings` key `channel_merges` (`{ map: { oldId: keptId } }`). Backup: `backups/channel-merge-2026-11-12.json` (all involved channels, links, sources, favorites, remapped history row ids, previous setting).
- Verified (data, live now): bdix 800 channels (was 953); no duplicate groups left except the 5 excluded; kept channels' `stream_url` = top active source; local M3U 793 live entries, 110 with smart links.
- Code deployed in `45ca69d` (user approved; live after ~50 s, verified `/watch/564-somoy-tv` → 865 and old smart link 564 → 302): new `lib/channelMerges.js`; `/watch/<oldId>` redirects to the kept channel (client-side redirect because the page streams; verified in a browser 564 → 865-somoy-tv); `/playlist/<token>/live/<oldId>` resolves to the kept channel.

### 2026-11-12 - Fix: client /watch stuck on skeleton / white page on mobile

- User report: after client login on mobile the page stayed on the skeleton; the iPhone PWA hung on "redirecting" and then showed a white page.
- Checked: Dokploy Fullstack logs showed no errors. Reproduced locally (temporary local-only guest switch, removed afterwards) at mobile size: `/watch/<id>` took ~19 s in dev.
- Root cause (regression from today): `lib/moviesData.js` `loadSourceMediaInfo` looked up codec info for every movie URL in chunks of 40 → ~114 sequential Supabase queries per page render. While the table did not exist the first query failed fast; once `movie_source_media_info` was created and filled today, every render paid ~11 s (measured: 114 queries 11.0 s).
- Fix deployed in `dd77a4a` (user approved; new build live ~50 s after push, build id 2026-11-12T051439Z): load only problem rows (`browser_audio_ok=false` or `status<>ok`, ~1.1k rows, 2 queries 0.3 s) via `unstable_cache` (10 min). Missing rows mean "unknown", so the player keeps its runtime check. Local production build: TTFB 0.1 s, full 11 MB page ~6 s on localhost.
- Still open: the 11 MB page size (Known open issue 6).
- Pending: user to confirm on the iPhone (PWA and browser) that login now opens the player.

### 2026-11-12 - Mobile watch page: category channel grid + compact player chrome (local, not deployed)

- User request: use the empty space under the player on mobile to list the playing channel's category; then: show it in multiple columns and make the controls/now-playing area smaller.
- New `components/iptv/MobileCategoryChannels.js` (tile grid: logo + name, playing tile highlighted; 3 columns on phones, 4 from 420px, 6 from 640px; first 48 + "Show all"); shown only ≤1023px and not in TV mode. `IptvHomeClient.js`: list = playing channel's category (or current list when nothing plays); tapping a tile switches channel and scrolls to the player.
- Phones (≤640px) CSS: controls in one row (volume slider and % hidden, mute kept), smaller now-playing card with icon-only favorite (`favoriteBtnLabel`), "Debug" badge hidden.
- Verified locally at 375×812 (temporary local-only guest switch, removed): grid renders under the player, tapping ATN News switched to `/watch/12-atn-news` and scrolled to top; `npm run build` passed. Not deployed.
- Planned (not started): more backup links for BD channels — see Pending item D.
- Deployed in `0943f19` (user approved; build 2026-11-12T053101Z live ~50 s after push; `/` 200, `/watch` 200, `/dashboard` 307). Mobile layout on production not yet seen by the user/agent while logged in.

### 2026-11-12 - Bangla link collection, round 1 (review only, nothing written)

- Sources: iptv-org `countries/bd.m3u` (44), `languages/ben.m3u` (104), iptv-org API streams for `.bd` channels → 117 unique URLs; 34 already in our DB. Matched by normalized name / tvg-id to our channels; probed from the user's Mac (ISP network): 41 of 68 played; frame grabs to confirm identity.
- APPLIED (user: "Yes, add all"): 14 backup links (Banglavision, Duronto TV, Zee Bangla, BHI Channel, Maasranga TV, DD Bangla, Republic Bangla, Khushboo Bangla, KTV Bangla, Sangeet Bangla, R Plus, R Plus Gold, TV9 Bangla, DD Sports) and 15 new channels (Dhoom Music, Akhon Kolkata, Globe TV, Headlines Tripura, Madani Channel Bangla, AK Bangla, Friends TV, Sony Aath, Raatdin Bangla, Rupasi Bangla, Sonar Bangla, U Bangla, News Live Bangla, Deen TV, Doyel TV). List: `backups/imports/bangla-links-review-2026-11-12.json`.
- Rejected: ATN Bangla ("No signal" slate), Orange Bangla TV (placeholder), Shiksha TV (Gujarati), tokenized jagobd/ncare links (expire; commercial apps), Gazi TV/JonmoBhumi/Nexus/NAN/Rupashi Bangla TV links that stopped answering.
- Gap: public lists have few working links for the big BD channels (Somoy, Jamuna, Ekattor, Channel 24, Independent, NTV, ATN). Next sources: user's own M3U/captures and BDIX/ISP IPTV portals.
- Applied 2026-11-12: 14 backup `channel_sources` (label `iptv-org`, appended after existing links) and 15 new channels in `bdix` (ids 2587-2591, 2593-2602; each with an `iptv-org` primary source, 14 with iptv-org logos, AK Bangla without logo because the tvg-id said Bangla Jago). Two failed runs (`channels.playlist_slug` and `logo_url` are NOT NULL) created no partial rows (2586/2592 do not exist). Backups: `backups/bangla-links-applied-2026-11-12*.json`. bdix now 815 channels.

### 2026-11-12 - Lighter /watch page: movie catalog loaded on demand (local, not deployed)

- User asked to make the channel page lighter. `app/watch/[channel]/page.js` now calls `getClientHomeData(..., { includeMovies: wantsMovies })`, where `wantsMovies` is true only for `?mode=movies`. The client already had a lazy path (`ensureMovieCatalogLoaded` → `/api/client/movies/bootstrap`, paged, 24 per page) used when no initial movies are given.
- Found and fixed a pre-existing bug in `components/iptv/IptvHomeClient.js`: when the bootstrap request failed, the effect retried immediately in an endless loop (seen as ~100 requests in a few seconds). It now stops on error and shows a "Try again" button.
- Measured on the local dev server (temporary local-only guest switch, removed afterwards; dev HTML is a bit larger than production): `/watch/865-somoy-tv` 1.7 MB raw / 123 KB gzip (with movies: 16.1 MB raw / 2.0 MB gzip). Clicking Movies loaded the catalog through the API (4,581 movies, categories shown). `npm run build` passed.
- Seen, not fixed: a React hydration-mismatch warning on `/watch` in dev (RightPanel, `selectedChannel` null on the server); not caused by this change.
- Deployed in `37b6392` (user approved): build 2026-11-12T071025Z live ~36 s after push; `/` 200, `/watch` 200, `/dashboard` 307, bootstrap API 401 signed out, public audit clean. Logged-in check on the user's phone pending.


### 2026-11-12 - skym3u playlist + link health review (review only, nothing written)

- User supplied `skym3u.dev.12.nov.26.m3u` (copied to git-excluded `backups/imports/skym3u-2026-11-12.m3u`): 365 entries, all `go.skym3u.dev` redirect links (Cloudflare blocks curl's default UA; a player UA gets a 302 to the real upstream, mostly `tvsen5/6/7.aynaott.com`, cloudfront, tangotv). Resolved every redirect and probed the upstream from the user's Mac: 327 play.
- Probed all 970 active `channel_sources` of bdix: 636 ok, 334 fail here. Frame grabs found slates that "play" but show no picture: Somoy TV primary (aynaott, "NO SIGNAL" test card) and ATN Bangla (aynaott, "No signal!"), the same in skym3u. The player cannot fail over from these because they are valid live streams. Somoy's 2nd link (`116.204.149.16`, http) shows real content.
- Also checked a public GitHub gist (973 links): only 31 play, few new.
- Plan prepared: `backups/imports/skym3u-review-2026-11-12.csv` (232 links: 55 backup, 21 backup placed first, 152 new channels + 4 extra links; 7 duplicate merges e.g. INDEPENDENT 10 → Independent TV 905; deactivate the 2 slate links; remove 211 channels whose every link fails here and that never played for a viewer). Scripts in session scratchpad `sky/`.

### 2026-11-12 - Applied skym3u review (production data)

- User approved ("Yes, apply all"). Full backup first: `backups/bdix-full-before-skym3u-2026-11-12.json` (815 bdix links, 815 channels, 996 sources, 13 other-playlist links, 16 groups, merge setting). Merge backup: `backups/channel-merge-skym3u-2026-11-12.json`. Apply log (ids of everything added/removed): `backups/skym3u-applied-2026-11-12.json`.
- Merged 7 duplicates (INDEPENDENT 10 → Independent TV 905; Channel 24HD 510 + Channel 24 1 866 → Channel 24 902; Jumuna TV 901 → Jamuna TV 541; Ekattor HD 71 903 → Ekattor TV 8; Deepto TV (BDIX) 869 + Deepto 1081 → Deepto TV 1267); favorites/history remapped, ids added to `channel_merges`.
- Deactivated the 2 "NO SIGNAL" slate sources (Somoy TV aynaott → main link now `116.204.149.16`, http, so web playback goes through `/api/stream-proxy` on Hetzner — not verified from there; ATN Bangla had no other working link → channel 16 set DEAD/hidden).
- Added 80 `channel_sources` (label `skym3u`; 21 placed first with `channels.stream_url` updated, e.g. Independent TV, Channel 24, Ekhon TV, Bijoy TV, Mohona TV, Channel 9, T Sports). Created 145 new channels (no logos yet) + linked 7 existing orphan rows into bdix (renamed, e.g. NDTV 24x7, Dunya News, DD Urdu).
- Removed 210 channels from bdix whose every link failed from the user's ISP and never played for a viewer (208 rows deleted, 2 kept for other playlists); includes BTV News, Sangsad TV HD, NEWS 21, Channel S, Colors Bangla HD.
- Verified: bdix 750 channels, all categories are existing groups; `/`, `/watch/865-somoy-tv`, `/watch/905-independent-tv` 200. Follow-ups: logos for the 145 new channels; aynaott-hosted links come from a third-party OTT and may stop; ATN Bangla, BTV News, Sangsad TV, NEWS 21 need new sources (official YouTube live is an option).


### 2026-11-12 - Logos for the skym3u channels

- User asked to add logos to the 145 new channels (+7 linked rows). Matched by same-name channels in our DB that have a logo and by iptv-org main/alt name with a country check (plus 9 hand-checked single candidates, e.g. MBC Bollywood, Iqra Bangla, beIN Sports). Checked each URL with curl (HTTP 200 + real image bytes); imgur links are unreachable from the user's ISP, so they were skipped.
- Applied 114 (only where `logo_url` was empty). Backup: `backups/channel-logos-round3-before-2026-11-12.json`. Result: 121 of the 152 have a logo; 31 still without (e.g. G TV, SNB Cinema, JA TV, Zodiak TV, Zindagi TV, HGTV). Script: session scratchpad `logos3/`.

### 2026-11-12 - ATN Bangla official-site stream: not used

- User asked to use the live stream on atnbangla.tv/live-tv. It runs in an mcaster.tv player that obfuscates the HLS URL and blocks use outside the site, so the link was not extracted. ATN's YouTube channels (@ATNBanglanews, @atnbangla) had no live stream at the time.
- A "Watch on atnbangla.tv" button was started and then dropped at the user's request; all code reverted, nothing deployed or written to the DB. ATN Bangla (id 16) stays DEAD/hidden.

### 2026-11-12 - Radio section (local, not deployed)

- User approved the radio design (prototype artifact https://claude.ai/artifact/Smz2dGjnbvYuLSune4sn7u) and asked for Radio both in the public header next to LIVE TV and inside the Live TV app menu.
- New (uncommitted): `vercel/supabase/radio_stations.sql` (tables `radio_stations`, `radio_station_sources`, RPC `record_radio_source_result`; NOT applied yet), `lib/radioData.js` (cached 60 s, tag `radio-stations`), `lib/radioAdmin.js`, APIs `/api/admin/radio`, `/api/admin/radio/[id]`, `/api/admin/radio/[id]/sources`, `/api/client/radio`, `/api/client/radio/report`; admin page `/dashboard/radio` (station list, drawer with details + ordered links + per-link Test); viewer page `/radio` (`components/radio/RadioPage.js`, `visualizers.js`, `radio.module.css`): FM dial with moving needle, 5 spectrum styles (Canvas 2D; 3D ring via `three@0.170.0` dynamic import), link failover (10 s startup, 12 s stall, error), CORS-analysed audio element with a plain fallback element (simulated spectrum), per-device remembered link, Media Session controls, listener results reported per link.
- Links: public header RADIO button (`radioLink` i18n key; mobile top row too), Live TV left menu "Radio", dashboard nav "Radio", M3U adds a "Radio" group (first active link per station). `/watch?mode=movies` now keeps the mode through the redirect. `/radio` hides the public header for signed-in viewers.
- Verified locally with a temporary sample list (removed): Radio Foorti plays with real analyser data, Spice FM (HLS) plays, 3D ring renders, Jago FM failed over from a dead link 1 to link 2, mobile 375 px fits (mode chips scroll inside their row). Tested 10 more BD streams in the browser: all play (8 with CORS). `npm run build` passed.
- Applied with user approval ("Yes, do all"): `radio_stations.sql` run in the Supabase SQL Editor (Success); anon read returns 401. Seeded 22 stations / 25 links (label `radio-browser`; ids in `backups/radio-seed-applied-2026-11-12.json`). FM frequencies of Foorti/Today/Shadhin/Bhumi/Spice still to be confirmed by the user.

### 2026-11-12 - Radio deployed (222f3cb); more stations; group tabs (local)

- Deployed `222f3cb` (build 2026-11-12T104324Z live ~36 s after push). Verified: `/` shows the RADIO button, `/radio` 200, `/dashboard/radio` 307 signed out, radio APIs 401 without session.
- User shared radio.garden (Dhaka). Its API blocks scripts (Cloudflare), so it was read only from the user's open Chrome page: 22 Bangladesh stations; stream URLs resolved where the stream allows CORS. FM numbers confirmed: Foorti 88.0, Today 89.6, Shadhin 92.4, Bhumi 92.8.
- Added to production data (user asked): 6 BD stations (ids 23-28: Radio Bikrampur 99.2, Radio Padma 99.2 Rajshahi, Relaks Radio Bangla, Radiosangbad.com, BU Radio, Young Leaders Forum) and 5 backup links (surfernetwork hosts for Dhaka FM/Bhumi/Shadhin/Today, https Betar Dhaka-A placed first for Bangladesh Betar). Log: `backups/radio-bd-additions-2026-11-12.json`. Not added (no readable stream URL): FM Moon, FnF.FM Bangla, Radio Amber 102.4, Traffic FM 88.8, Commercial Service 630 AM; Radio Nalta / Radio Mahananda links returned 404.
- Local, not deployed: station groups (`radio_stations.region`, default Bangladesh; SQL file updated with `alter table … add column if not exists region`), group tabs on `/radio` (dial and prev/next stay within the group), admin Group select, M3U group `Radio · <group>`. Tested locally: India · Bangla tab plays Akashvani FM Rainbow Kolkata 107.0 (HLS). India seed prepared (30 stations: 11 India · Bangla incl. Akashvani Rainbow/FM Gold Kolkata/Kolkata A/Maitree; 19 India · Hindi incl. AIR News 24x7, FM Gold Delhi, Vividh Bharati, Aaj Tak Radio) in session scratchpad `rg/india-seed.json`, all tested in a browser.
- Applied with user approval ("Yes, do all"): `region` column added in the Supabase SQL Editor; 30 Indian stations seeded (India · Bangla 11, India · Hindi 19; log `backups/radio-india-seed-2026-11-12.json`). Totals: Bangladesh 28, India · Bangla 11, India · Hindi 19.
- Deployed `6f32d13` (build 2026-11-12T105703Z, ~42 s after push). Verified in the user's signed-in Chrome: `/radio` shows tabs Bangladesh 28 / India · Bangla 11 / India · Hindi 19. Signed-out `/radio` redirects to `/client-login?next=/radio`.

### 2026-11-12 - Radio: iPhone spectrum, phone layout, favourites, still Halo (local, not deployed)

- User report (iPhone): audio plays but the spectrum stays flat; on phones only the player fits, stations are far below; wants favourite radio stations in their own tab; Halo should not spin and bar tips should fade.
- Changes (uncommitted): `visualizers.js` — if the analyser returns only zeros for ~1.5 s while playing (iPhone Safari with live streams), switch to the beat-shaped motion; Halo fixed (no rotation) with bars solid at the ring fading to transparent at the tip. `radio.module.css` — phone layout (≤640 px): compact header/dial/stage (150 px)/transport, volume slider hidden (phones use hardware volume), station rack as a 3-column tile grid (4 from 420 px); first tile row now visible below the player at 375×812. Favourites: heart next to the station name and on each tile, "Favourites" tab before the groups; signed-in viewers save to new table `client_radio_favorites` (added to `supabase/radio_stations.sql`, NOT applied yet) through `/api/client/radio/favorites` (GET/POST); guests keep them on the device (localStorage).
- Verified locally at 375×812 (temporary guest switch, removed): Halo still and fading, tiles start at ~665 px with the public header (signed-in viewers do not see that header), guest favourite saved and shown in the Favourites tab. iPhone behaviour itself not verifiable here. `npm run build` passed.
- Pending (needs approval): run the `client_radio_favorites` SQL, commit + push.
- Follow-up (same release, local): opening /radio resumes the last station (or the group's first) automatically; if the browser blocks sound before a touch (iPhone, fresh visit), the hint says "Tap anywhere to start listening" and the first tap starts it. Choosing a station (tile, dial, group tab, next/previous) always starts playback. Radio header logo no longer squashed (height 30 px, width auto). Verified locally: auto-resume of the last station, tile tap starts playback while paused.
- Radio logos (user: "Need actual logo for all radio channel"): 37 of 58 stations now have their real logo (data, live now): radio-browser favicons matched by stream URL, TuneIn search images for Peoples Radio / Radio Shadhin / Radio Vivid Voice / Radio Padma / Radio BollyFm, Wikimedia Bangladesh Betar logo for the three Betar stations, AIR logo for the Akashvani stations. Each URL checked (HTTP 200 image with a webtvbd.com referer) and reviewed on a contact sheet (rejected: a "106.5 FM" logo for AIR, wrong "4 lobos" matches, zeno.fm generic icons). Log: `backups/radio-logos-2026-11-12.json`. 21 stations still show initials (no reliable logo found, e.g. Jago FM, Radio GoonGoon, Radio Bikrampur, Radio Mirchi Lucknow, FnF.FM Hindi). Logos now display with object-fit contain on a white card (radio page + admin), part of the pending deploy.
- Four more spectrum styles from the user's reference images (same pending release): "Neon horizon" (glowing horizon line, pink/cyan spiky waves, dotted perspective floor), "Particle peaks" (dotted perspective terrain with glowing spikes), "Wave mesh" (flowing perspective lines with dots), "Glow hills" (smoothed orange→pink→blue hills with glow and reflection). Canvas 2D, fixed neon palettes. Viewed locally on desktop and 375 px with a playing station.
- Glow hills reworked after user feedback ("flat", wants layered 3D, smooth curves, thick layers, each layer reacting to a different part of the sound): 9 thick shaded layers (7 on phones) drawn back to front with occlusion, Catmull-Rom smooth rounded hills, bright crest + darker foot, bloom (canvas blur where supported) and water reflection. Each layer follows its own frequency range (back = sub-bass/bass, middle = vocals, front = highs) with its own auto-gain and speed (bass slow, highs quick); back layers taller so the depth reads. Checked locally with a playing station.
- Glow hills, round 3 (user feedback): peak shape now follows the sound per hill (quick changes / higher ranges → pointed peaks, steady low sound → round domes, blended per hill); every layer has its own number of hills and sideways offset so peaks no longer line up; layers fade in/out with their frequency range's level, so busier music shows more layers; background is a night sky (gradient, moon glow, twinkling stars) over a sea with reflection and faint shimmer. Viewed in the local preview (still running for the user on 127.0.0.1:3010 with the temporary guest switch in `app/radio/page.js`, marked TEMP-LOCAL-DEBUG — remove before committing).
- Glow hills, round 4: round vs sharp now comes from the sound per hill — energy spread across the range stays round, energy concentrated in one hill or a sudden attack (rise well above that hill's usual change) turns it pointed, which then relaxes back (fast attack, slow release); measured locally: sharpness mostly ~0.1 with occasional 0.4–0.5 spikes. Fewer, wider hills per layer (3–7); neighbouring hills never equal height (no flat tops); layer height capped so peaks are never clipped.
- Full-screen spectrum: button in the spectrum's corner; uses the Fullscreen API where available plus a fixed full-window layer (works on iPhone too), with play/pause, station name + frequency and previous/next at the bottom, Esc or the button to exit. Checked in the local preview (enter + exit).
- Full screen, round 2: station logo + frequency + name (EN/BN) panel top-left; "Hide all info" button (eye) leaves only the spectrum, a tap brings the controls back (hint fades after 3 s); bottom bar keeps play/pause + previous/next. All full-screen overlays use a clear "liquid glass" style (light backdrop blur + saturation, bright rim, specular sheen) so the spectrum shows through; plain translucent fallback where backdrop-filter is unsupported. Checked in the local preview (enter, hide, tap to show, exit).
- Full screen, round 3 (user: everything too big, put all at the bottom in one line): replaced the top-left title, corner buttons and bottom bar with one slim glass dock along the bottom — station logo/name/frequency on the left, previous/play/next in the centre, hide-info and exit on the right; buttons 30 px (play 36 px), text 10.5–12.5 px. The enter-full-screen button stays in the spectrum corner only outside full screen. Checked in the local preview.
- Keyboard (radio page, like the TV player): F full screen on/off, I hide/show info in full screen, Esc exit, ←/→ previous/next station, ↑/↓ volume ±5 with a "Volume n%" toast. Uses the physical key (`e.code`), so F/I also work with Bangla layouts (also matches ফ / ই / ি); ignored while typing in inputs or with Ctrl/Cmd/Alt. Hints: next to the style chips in normal view and inside the full-screen dock (hidden on touch screens and below 900 px). Dock now: WEBTVBD logo | divider | station logo + frequency + name, controls in the centre, key hints + hide/exit on the right. Fixed a crash when an older hill state lacked `fluxAvg` (state is rebuilt when its shape changes). Verified in the local preview with dispatched key events (Bangla F/I, arrows, Esc).
- Spectrum messages (user request): bold animated text inside the radio spectrum. Default "Developed by WEBTVBD.com". Admin control panel on Dashboard → Radio ("Spectrum messages"): on/off, custom messages (add, edit, enable, reorder, delete), add a published notice from `admin_announcements` (its title), editable credit line, seconds per message (5–30). Stored in `admin_settings` key `radio_spectrum_messages` (no new table); `lib/radioMessages.js` (cached 60 s, tag `radio-messages`), API `/api/admin/radio/messages` (GET/PUT, admin only). Player: top-centre of the spectrum, gradient bold text with a glow that breathes with the bass, blur-in / fade-up out, rotating through the list; texts over 46 characters scroll across; a clear glass pill/strip keeps it readable over any style; larger in full screen. Verified in the local preview (default credit cycling, readable over Prism bars, full screen). The admin panel itself was not opened (needs an admin login in the preview); its API returns 401 without a session.
- Spectrum messages moved to the empty reflection area near the bottom (7% from the bottom; in full screen just above the dock) and made smaller (12–16 px, 14–20 px full screen) after user feedback. Checked in the local preview.
- Spectrum messages: plain glowing text only (no pill, outline or padding) on phone and desktop. Added previous/next spectrum-style buttons: small round arrows on the left/right of the spectrum in normal view, and a "‹ style name ›" switcher in the full-screen dock (name hidden on phones); each change shows the style name as a toast. Checked in the local preview (phone 375 px and desktop, full screen).
- Style arrows in normal view are now invisible by default; moving the pointer over the spectrum (or touching it on phones) slides them in from both sides with a pulsing mint glow, and they fade out ~2.2 s after the pointer stops or leaves. Keyboard focus also reveals them. Checked in the local preview (hidden → shown on move → hidden after idle).
- Deploy (user: "Yes, deploy"): temporary preview switch removed; `client_radio_favorites` created in the Supabase SQL Editor (service read 200, anon 401); build passed; committed and pushed to master (see next lines for the commit and live check).
- Deployed `f8f6112` (build 2026-11-12T120739Z, ~36 s after push). Verified: `/`, `/radio`, `/watch` 200, `/dashboard` 307, favourites and messages APIs 401 without a session; in the user's signed-in Chrome `/radio` shows Favourites + 3 group tabs, 9 style chips, the full-screen button, the style arrows, 28 station tiles and the "Developed by WEBTVBD.com" message; `/dashboard/radio` shows the Spectrum messages panel (credit line loaded, notices listed) and 58 stations.
- (local, not deployed) Phones/tablets (≤980 px): the player deck is sticky at the top and the station search sticks right under it (`--deckH` measured with a ResizeObserver); only the station tiles scroll underneath. Checked in the local preview at 375×812 (temporary guest switch active again in `app/radio/page.js`, TEMP-LOCAL-DEBUG — remove before commit).
- iPhone report: spectrum moves but not with the music. Cause: iPhone Safari returns only zeros from the Web Audio analyser for live radio streams, so the player falls back to a beat-shaped animation. Real rhythm on iPhone would need a second, analysis-only download of the stream (decoded in Web Audio, not heard) — roughly doubles radio data use on iPhone (~57 MB/hour extra at 128 kbps). Awaiting the user's decision.
- iPhone rhythm (user: "Yes, try it"), local: `components/radio/shadowAnalyser.js` — when the main analyser returns only zeros for ~1.5 s while a non-HLS link plays, a muted analysis-only copy of the stream is fetched, decoded in ~0.5 s chunks with decodeAudioData and scheduled into its own analyser, delayed by the audio element's buffer to line up with what is heard; falls back to the beat motion if it cannot read the stream (no CORS) after 3 tries. Stopped on pause/station change. Test switch: localStorage `webtvbd:radio-force-shadow=1`. Verified in desktop Chromium with the switch: the copy starts and Radio Foorti chunks decode (real audio). Not yet verified on an iPhone.
- LAN preview for phones: dev server now on 0.0.0.0:3010 (Mac LAN IP 192.168.10.186), `allowedDevOrigins` (192.168/10/172.16) added to `next.config.mjs` (dev only, no effect in production).
- iPhone report after the first try: spectrum still the same on every station in iOS Safari and Chrome (= beat fallback; the analysis copy was not working there). Fix (local): chunks are now cut exactly on MP3 / AAC-ADTS frame boundaries (iOS decoders reject partial frames), remainder carried over; `#radio-debug` on /radio shows a one-line readout (AudioContext state, main analyser peak, analysis-copy state, KB read, chunks decoded, errors) for diagnosing phones. Verified in desktop Chromium with the force switch: copy "working", chunks decoding. iPhone still to be checked by the user.
- Spectrum "Off" chip (first in the style row): hides the spectrum area, stops drawing and the analysis copy (saves data/battery), remembered per device; F does nothing while off. Verified locally (radio keeps playing; choosing a style brings it back).
- iPhone still showed the same motion on every station. Changes (local): the analysis copy now also starts when the stream had to fall back to the plain (non-analysed) player — likely the iPhone case; if the station blocks direct reading, the copy is retried once through `/api/stream-proxy`; clearer `#radio-debug` line (adds player analysed/plain and device). Desktop checks: CORS station → copy working; Dhaka FM (Shoutcast "ICY" response) → direct copy blocked, proxy returns 502 (Node fetch rejects ICY), so that station keeps the beat motion. Temporary guest switches (TEMP-LOCAL-DEBUG) in `app/radio/page.js` and `app/api/stream-proxy/route.js` — remove before commit. Waiting for the user's iPhone debug line.
- iPhone debug line (user screenshot): `ctx:running main peak:0 simulated:false | copy:working 314KB ok:7 err:0 | player:analysed | iPhone` — the analysis copy downloads and decodes on iPhone, yet the spectrum still looked the same. Changes (local): the copy's output gain is 0.0001 instead of 0 (WebKit may skip a fully silent branch); debug line adds seconds decoded, "ahead" and the copy analyser's own peak (`copyPeak`).
- User found on desktop: lowering the volume (to 0) made the spectrum fall back to the beat motion. Cause: volume was set on the <audio> element, which also scales what the analyser sees. Fix (local): the analysed element stays at full level and volume is a GainNode after the analyser (plain element still uses its own volume). Verified: Radio Foorti main peak 238 at normal volume, 203 at volume 0.
- Station tile of the playing station scrolls into view on change (next/previous, keys, dial), below the sticky player on phones (scroll-margin). Desktop station list did not scroll with the mouse wheel: `PublicSmoothScroll` (Lenis) was active on /radio; `/radio` added to its disabled list.
- iPhone debug after the gain fix: `copy:working 338KB ok:10 43s ahead:7.3 copyPeak:55 | player:analysed | iPhone` — the copy's analyser now gives data on iPhone. Two follow-ups fixed (local): (1) timing — radio servers send a burst of recent audio on connect and players start from its beginning, so the copy now schedules each decoded chunk for the moment the player's `currentTime` reaches it (copy position + connection-time offset), instead of "now + buffer"; desktop check with the force switch: bass-energy correlation main vs copy 0.81 at 0 ms, 0.5 at ±200 ms, ~0 at ±1 s (in sync). (2) noise gate in the band reader (bins below ~60/255 stay flat), so hiss/silence (e.g. Betar Commercial) does not light up.
- User: the fallback "beat" looked identical for music, speech and hiss (also seen on desktop with Dhaka FM). Removed the fake beat: stations without readable audio now show a slow calm swell plus the note "Live spectrum is not available for this station".
- Deploy (user: "Works now, deploy" after checking on iPhone over the LAN): temporary guest switches removed (`app/radio/page.js`, `app/api/stream-proxy/route.js` back to committed versions), LAN dev server stopped. `allowedDevOrigins` stays in `next.config.mjs` (dev only).
- Deployed `c93195c` (build 2026-11-12T131300Z, ~36 s after push). Verified: `/`, `/radio`, `/watch` 200, `/dashboard` 307; in the user's signed-in Chrome `/radio` shows the Off chip + 9 styles, Favourites + 3 group tabs, the sticky search bar, 28 tiles and the spectrum message. iPhone real-rhythm behaviour was confirmed by the user on the LAN preview before deploy.

### 2026-11-12 - Promo video: voiceover final, hook preview rendered (local only)

- User goal: a ~60 s fast-paced Bengali promo (TV, movies, radio, "free"), 16:9 master + 9:16 cutdown, realistic 3D devices with real site screens. Process the user set: script → audio final → 5-second preview → approval → full video.
- Files (all under `docs/promo-video/`, uncommitted): `storyboard.html`/`.pdf` (published as artifact https://claude.ai/artifact/PaJg1LJoGTbAZmWRys74ri), `audio/webtvbd-vo-hana-v2.wav|mp3` (final VO, ElevenLabs voice "Hana" via Higgsfield, 60 s, "free" in S2 and S10; timing in `audio/webtvbd-vo-hana-v2-timing.json`, built by `audio/build_vo.py`), per-scene takes in `audio/hana/`.
- Tool decision: Claude Motion cannot take the user's audio or Three.js/3D models, so the video is built with HyperFrames (plugin 0.8.145) in `docs/promo-video/video/` (Three.js glass icons, PBR + RoomEnvironment, bloom, grain; music `assets/audio/music-bed-v1.mp3` from ElevenLabs Music via Higgsfield; SFX from the HyperFrames bundled library plus synthesized glass taps). An empty Motion film https://claude.ai/artifact/RYQiTNwZGZxpEeifXv2G5K exists unused (user may want it deleted).
- Rendered `video/renders/webtvbd-hook-preview-v1.mp4` (0–7.3 s hook, 1080p30, −13.4 LUFS) and style frames in `video/style-frames/`. Awaiting the user's approval before building the remaining scenes.
- Google Drive copies were uploaded by mistake (user meant the local drive) and moved to Drive trash at the user's request.
- Follow-up (same day): user chose Hind Siliguri (OFL) as the video font over the compared options (sheet: `video/font-options/font-options.png`). Preview re-rendered as `video/renders/webtvbd-hook-preview-v2.mp4`; style frames refreshed. Anek Bangla files removed from the project.
- 2026-11-12 (later): full 60 s 16:9 promo rendered: `docs/promo-video/video/renders/webtvbd-promo-16x9-v1.mp4` (master) and `webtvbd-promo-16x9-v1-share.mp4` (−14.2 LUFS, 75 MB). Built in HyperFrames: `video/index.html` + `video/js/{main,hook,world,overlay}.js` (procedural Three.js laptop/monitor/tablet/phone, logo block, 2D spectrum driven by `assets/audio/music-bands.js`). Screens are real local captures (`docs/promo-video/capture/`, Playwright against a local production build on 127.0.0.1:3100 with temporary guest access in `app/watch/[channel]/page.js` and `lib/clientApi.js`, both reverted after capture). Live-TV video areas are blurred on purpose (third-party broadcasts, politicians, ads); movie posters are Kolkata Bangla titles. `npm run build` in `vercel/` overwrote `.next`, so the dev server on 3010 may need a restart. 9:16 cutdown pending user approval of the 16:9 cut.
- 2026-11-12 (later): SFX remix after user feedback (failover glitch drowned the voice): glitch shortened/quieted, other SFX under speech lowered, closing hit moved after the URL. Renders: `video/renders/webtvbd-promo-16x9-v2(-share).mp4` (60 s, −14.2 LUFS) and the 9:16 cut `video-916/renders/webtvbd-promo-9x16-v1(-share).mp4` (37.9 s, −13.9 LUFS; time map in `video/js/config.js`, `video-916/` symlinks `js` and `assets` to `video/`).

### 2026-11-13 - Promo videos posted to the WEB TV BD Facebook page

- With the user's approval of the drafted text (`docs/promo-video/social/facebook-posts.md`), posted from the user's Chrome via Meta Business Suite (the user attached the video files; the Chrome upload tool is limited to 10 MB): 16:9 v2 (60 s) and 9:16 (38 s). Business Suite publishes videos under 90 s as Reels, so both are Reels: https://www.facebook.com/reel/1627010945112251 (16:9) and https://www.facebook.com/reel/1483307137046661 (9:16). Logo frame as cover, auto-captions off, Facebook's copyright check reported no issues.
- No link in the captions; a first comment from the page holds https://webtvbd.com on both (verified visible as "WEB TV BD · Author").
- To comment as the page, facebook.com was switched to act as WEB TV BD; it stays switched until the user switches back.

### 2026-11-13 - Radio: iPhone spectrum reliability, HLS stations, phone full screen (deployed b36c1fc)

- User report (iPhone, live c93195c): spectrum worked only sometimes; reload sometimes helped; then: stopped after switching stations. Laptop/Android fine (their main analyser has data).
- Causes found and fixed in `components/radio/shadowAnalyser.js` / `RadioPage.js` / `visualizers.js`:
  - copy timing used the moment `src` was set; some stations answer seconds later (Radio Today ~4.4 s) → now both player (`progress`/`loadedmetadata`) and copy (first bytes) are measured from their first audio. Desktop correlation main vs copy: Radio Today +0.15 s (was +3.15 s), Foorti −0.2 s. A buffered-end method was tried and rejected (Chrome does not download to the live edge).
  - decodes could finish out of order (long connect-burst chunk) → decoded in sequence.
  - band reader latched into the idle swell after 1.5 s of silence and never read the analyser again → the real cause of "flat after station switch" (the copy's first audio comes a few seconds later). It now keeps reading.
  - after 3 dropped chunks in a row the copy re-anchors instead of staying silent; debug line shows `off`, `anc`, `pt`, `drop`.
  - after the first station on a zero-analyser device the copy starts after ~0.15 s instead of 1.5 s.
- HLS copy (`startHlsShadowAnalyser`): 12 of 69 radio links are HLS (AIR/Akashvani bitgravity `.aac` segments; Spice FM, Din Raat, Aaj Tak TS). Reads the playlist directly or via `/api/stream-proxy` (AIR playlists have no CORS; segments do, so segments are read directly), extracts ADTS/MP3 from ID3-packed AAC or MPEG-TS, aligns via the player's `seekable` end (Safari) re-anchored when it moves, or the hls.js fragment timeline. Chrome's native HLS gives no seekable range, so desktop Chrome cannot use it (not needed there when CORS allows the main analyser). Pipeline checked on desktop with a fake player; alignment confirmed only by the user on the iPhone ("improvement", short silence after a switch). Proxy needs a signed-in viewer (guests: note "not available").
- Phones: full-screen button works with one tap (touch on a button no longer reveals the style arrows, which iOS treated as hover); landscape (coarse pointer, height ≤540 px) opens the full-screen spectrum, portrait restores it.
- Tested on the LAN preview (temporary guest switches in `app/radio/page.js` and `app/api/stream-proxy/route.js` and a debug hook, all removed before commit). User approved ("Works, deploy"). Build passed; pushed `b36c1fc` (plus pending `fc74af4`) to master; build 2026-11-12T184425Z live ~40 s after push; `/`, `/radio`, `/watch` 200, `/dashboard` 307. iPhone check on the live site not yet reported.
- Note: AGENTS.md also holds uncommitted promo-video entries from another session; this file was left uncommitted so those are not committed by this task.

### 2026-11-13 - New Facebook page cover for WEB TV BD

- Designed a 1640×624 cover (dark brand background, white-text version of `vercel/public/logo.png`, "Live TV • Movies • FM Radio", Bengali tagline, category chips, FM tuner dial, spectrum bars, webtvbd.com). No third-party logos or broadcast images. Key content sits inside the mobile crop (centre 1109 px); the bottom-left under the desktop profile picture only has spectrum bars.
- Files (uncommitted): `docs/brand/facebook-cover-2026-11-13.png`, `docs/brand/facebook-cover-2026-11-13-mobile-view.png`, source `docs/brand/facebook-cover-src/` (HTML template, build.py, render.mjs using Playwright + Chrome; fonts are in `docs/promo-video/video/assets/fonts/`).
- With the user's approval ("Upload it"): uploaded via Meta Business Suite → Home → Edit cover photo → Upload photo → Save changes, in the user's Chrome. Verified after a reload: the new cover shows on the Business Suite home page.

### 2026-11-13 - TV player no longer starts channels muted (deployed 4f199ea)

- User report: after a channel switch the next channel often started muted; sound needed M or the volume control.
- Cause (`components/iptv/VideoPlayer.js` `tryStartPlayback`): any `play()` rejection, including the `AbortError` that a channel switch or failover causes, triggered the muted-autoplay fallback (muted + volume 0).
- Fix: only `NotAllowedError` allows a muted start, and never once `navigator.userActivation.hasBeenActive`; other rejections retry with sound (3 tries, 250 ms apart); the muted fallback keeps the volume; after a real muted autoplay start the first click/tap/key anywhere (except M) restores sound.
- Verified on the local server (temporary guest switches in `app/watch/page.js`, `app/watch/[channel]/page.js`, `lib/clientApi.js`, reverted before commit): quick double Next, Next and → key all started unmuted at volume 1. The first-visit no-click case was not tested. User approved deploy; `4f199ea` pushed to master, build 2026-11-13T140327Z live ~40 s after push; `/`, `/radio`, `/watch` 200, `/dashboard` 307.

### 2026-11-13 - AdSense status check (read-only)

- User asked why AdSense is not approved and what to do. Read Gmail (user's Chrome, rajibrt@gmail.com) and AdSense: review rejected 2026-08-14 (generic "fix some issues"), account reset 2026-09-02 for 5+ months without impressions, AdSense home now "deactivated because it's inactive" + Reactivate button; Sites/Policy Center not reachable. Nothing clicked or changed.
- Live checks: ads.txt correct, `google-adsense-account` meta present, robots fine, sitemap 34 URLs, `npm run audit:public` 0 warnings / 0 failures, `/watch` and `/radio` redirect anonymous visitors to `/client-login`, legal pages 200 (privacy is `/privacy-policy`). The AdSense loader script is not in the anonymous HTML (consent-gated).
- Main risk identified: the public About page describes the service as live TV channels and on-demand movies; AdSense's copyrighted-material policy covers sites whose main purpose is streaming content the publisher is not licensed to distribute, regardless of where the ads sit. Plan given to the user (reactivate, decide positioning, content, CMP, then one review).
- 2026-11-13 (later): user clicked **Reactivate account**. Verified in AdSense (read-only): Home shows "Let's get you started" (Payments info OK, Ads settings confirmed, Sites "Connect your site" required); Payments → Your earnings **$51.92** retained (payout threshold $100; transactions Sep/Oct/Nov 2026 each show $51.92 balance), wire transfer to bank account ending 5001; red banner asks for Singapore tax info. Sites: webtvbd.com "Requires review", ownership verified, ads.txt status "Not found" (AdSense's crawl is stale: live `https://webtvbd.com/ads.txt` 200 text/plain with the correct line, www/http redirect to it, Googlebot UA 200). Policy center: "No current issues". **Request review not clicked** — waiting for the user's decision after site preparation.

### 2026-11-13 - sky.m3u import, black/slate cleanup, playlist-import skill

- User supplied `~/Downloads/sky.m3u` (copy: git-excluded `backups/imports/sky-2026-11-13.m3u`): 1,515 entries, 1,514 `go.skym3u.dev` redirect links resolved with a VLC UA to 1,456 unique real URLs (59 duplicate entries; 510 already in our DB). Probed from the user's Mac: 1,089 play. Existing bdix sources: 746 of 980 play here.
- Found the black Bangla channels: NTV, ATN News, Channel 24, NEXUS TV, Akash Aath and one Deepto link are audio-only streams (aynaott master has only `mp4a`), so the player shows black with sound and does not fail over. No video link exists today for NTV, ATN News, Channel 24, NEXUS TV → marked DEAD.
- Applied with user approval ("Yes, apply all"); backup `backups/bdix-full-before-sky-2026-11-13.json`, log `backups/bdix-full-applied-sky-2026-11-13.json`: 247 backup links (label `sky`) on 154 existing channels, 121 new channels (172 links), 138 priority changes (dead-here links moved below working ones, kept active), 23 channels marked DEAD, 40 deleted (generic names + aynaott US channels added 2026-11-12 that already returned 404), 37 `channels.stream_url` updated (2 skipped: UNIQUE conflict on ids 533, 1151).
- Frame review of every new link and all ~600 existing non-Bangla links (user asked to remove "plays but black / no permission" links): removed 7 new slate links (`backups/sky-slates-removed-2026-11-13.json`; deleted new channels Maha Movie, Maha Punjabi, Sindh TV) and 29 existing slate/black links (`backups/bdix-slate-links-removed-2026-11-13.json`; deleted 25 channels such as Polsat/Canal+/Setanta/Russia Football restreams, Real Madrid TV black copies, Sanskar/Satsang Web TV; Eleven Sports 3/4 and Canal+ Sport HD kept with their other link).
- Result (verified via DB): bdix 806 channels, 781 LIVE, 25 DEAD. `/`, `/watch/905-independent-tv`, `/watch/541-jamuna-tv` 200. Non-Bangla new channels were matched by name and checked for picture, but not individually for identity.
- New (uncommitted): skill `.claude/skills/playlist-import/SKILL.md` (knowledge base for this work, for any AI; radio and movies to follow the same method) and scripts `vercel/scripts/channel-import/` (01–11). AGENTS.md now points every agent to the skill. Not committed or deployed (no site code changed).

### 2026-11-13 - AdSense site preparation: bilingual articles, new guides, article redesign (local, not deployed)

- User decided: English is the default language, Bangla via the switch; asked for human-quality articles with realistic images and a professional article layout. Google Translate was not used (widget retired for new sites, machine quality); every article now has hand-written editions.
- Data: `lib/publicArticles.js` gains `translations` per article (`buildTranslations`) and `localizeArticle(article, locale)` (same URL, edition swapped by `site_lang`). New `lib/staticEditorialArticlesPhase3.js` (10 new guides; English main + Bangla `translations.bn`) and `lib/staticEditorialArticlesPhase3En.js`. English editions of the 22 older Bangla articles in `lib/editorialTranslationsEn1.js` / `En2.js` (written by two sub-agents, structure and links checked), attached as `translations.en`; their slugs stay unchanged.
- New guides (2026-11-11…13): TV buying, viewing distance/eye comfort, radio history in Bangladesh, online radio data use, cable/DTH/IPTV/OTT, pirated stream risks, smart TV for parents, power cuts (UPS/IPS/surge), Bangladeshi cinema history, phone battery while watching video. Images: Higgsfield Soul 2.0 (2k, 16:9) → `public/editorial/*.webp` 1600×900; two regenerated (garbled poster lettering, too dark).
- Design: article page rebuilt (breadcrumb, kicker, balanced title, dek, byline, 16:9 hero, 720px body, sticky "On this page" TOC, styled sources box and editor's note, share + policy footer, Related articles grid); `/articles` rebuilt (featured lead + two side cards, latest grid, clean pager, 12 per page). `app/globals.css` `:lang(bn)` now puts Latin glyphs in the Latin face and Bengali in Siyam Rupali (fixes the mixed-script title look). About page and root metadata rewritten as an editorial publication (members' viewing area mentioned honestly).
- Verified locally: all 32 article titles English by default, Bangla edition with `site_lang=bn`; `npm run build` passed. Not committed or deployed; pending user review, then AdSense CMP message and Request review.
- Deployed 2026-11-13 in `335bae2` (user: "Looks good, deploy"; includes the Movies rows home, hero pause/cross-fade, Home button, reload/back fixes, header buttons + language switch, TV mute fix earlier in `4f199ea`). Temporary guest switches reverted before commit. Build 2026-11-13T153005Z live ~20 s after push. Verified: `/`, `/articles`, `/about`, `/radio`, `/watch` 200, `/dashboard` 307, new article + image 200, English titles by default; `npm run audit:public` → 44 sitemap URLs, 32 articles, 5 redirects, 0 warnings, 0 failures. Next (user): AdSense Privacy & messaging consent message, then Request review once.

### 2026-11-13 - AdSense consent message: found unused; loader fixed (deployed ddbb3d0)

- AdSense → Privacy & messaging → European regulations: a message "European regulations message - webtvbd.com" already exists (created 2026-03-28, Published); messages shown 0. Nothing changed in AdSense.
- Cause: `components/site/PublicConsentManager.js` only added the AdSense loader after a visitor clicked Accept on our own banner, so Google's consent message never ran and reviewers/crawlers never saw the ad code. Now the loader is added on monetizable pages (`/`, `/articles*`) once the stored choice is read; a decline sets `requestNonPersonalizedAds=1` before the loader; StatCounter still needs Accept.
- Deployed `ddbb3d0` (build 2026-11-13T154430Z, ~30 s). Verified live with no stored choice: adsbygoogle.js present and loaded, banner shown. Next (user): wait a few hours to a day, then AdSense → Sites → webtvbd.com → Request review (once).

### 2026-11-13 - Admin Overview redesign (local, not deployed)

- User approved the new information architecture ("Yes, build it"). Files (uncommitted): `vercel/app/dashboard/page.js` (rewritten), new `vercel/app/dashboard/overview.module.css`, `vercel/lib/dashboardReports.js` (rewritten; no longer queries the missing `viewer_activity_events`), `vercel/lib/activeViewers.js` (fix), `vercel/app/dashboard/UserArrivalTrendCharts.js` (one chart with 24h/7d/30d/12m tabs, peak + average instead of a sum of unique counts), `ActiveViewersPanel.js` (styled as a KPI, signed-in wording), `page.module.css` (tab styles appended); deleted the now-unused `CopyUrlButton.js`.
- Layout: "Needs attention" chips (pending sign-ups → Clients; channels failing for viewers, dead channels, channels without a backup link → playlist Health tab) or "All clear"; 6 KPIs with change vs the previous period (Watching now, Active viewers 24h, Watch time 24h, Plays 24h TV+movies, Failure rate 24h in points, New users 7d); Viewers chart + Users card (approved/pending/Facebook/push, sign-in mix 24h, all-time sign-ins and TV plays); Top channels 7d (watch time, logos), Top movies 7d (unique viewers from `movie_playback_attempt`/`movie_progress`, posters), Top radio (since launch, from `radio_station_sources.success_count`); Failed plays by channel 7d (only channels that still exist) + Link health (channel-level, same rule as the Health tab: ≥3 failures and failures ≥ plays); one-line system strip (playlists/slots/M3U links, movies, radio stations, server auto-check Off + toggle).
- Removed: guest cards and the four Guest vs Logged-in charts (always 0; guests cannot watch), duplicate Push card, six "Open X" shortcut cards, big cron card, Detailed Tables (playlist table lives on the Playlists page).
- Bug fixed: "Watching now" was always 0. The fallback (used because `viewer_activity_events` is missing) sent one `.in(user_id, …)` with every client id (1,443) and failed; it now reads recent events first and looks up only those users. Also fixes the Clients page panel.
- Verified in the user's Chrome on 127.0.0.1:3010 (desktop 1456 px and 420 px): all sections render with real data (e.g. watching now 1, active viewers 4, plays 399, failure rate 15.9%, 4 failing / 25 dead / 542 single-link channels). Reports load ~2 s.
- Deployed (user: "Yes, deploy"): `npm run build` passed (the other dev server on 3010 kept running), commit `ca524b7` (8 dashboard/lib files only; AGENTS.md left uncommitted because it holds other sessions' notes) pushed to `origin/master`; Dokploy autodeploy live within ~70 s. Verified in the user's signed-in Chrome: https://webtvbd.com/dashboard shows the new layout with live data (watching now 1, plays 378, failure rate 16.5%, 4 failing / 22 dead / 543 single-link). `/`, `/watch`, `/radio` 200, `/dashboard` 307 signed out. Chart hour labels on production use the server time zone (UTC), as before.

### 2026-11-13 - NTV, ATN News, Channel 24 back via official YouTube live (deployed 928e91c)

- Searched 57 candidate HLS links (old DB copies in other playlists, iptv-org bd/ben/index, ahmed-bd-org workers proxies, earlier import files, guessed paths on known hosts) from the user's network: none had video (workers proxies relay the same audio-only aynaott streams). The official sites (ntvbd.com/livetv, atnnewstv.com, channel24bd.tv/live) all embed YouTube; verified `isLiveNow:true` on @NTVDigitalLive, @atnnewsltd, @channel24digital.
- Code (user approved, "Yes, deploy"): new `lib/youtubeSource.js`; `VideoPlayer.js` shows YouTube's embed for YouTube sources (IFrame API: ready/playing confirm, error → failover); M3U and `/playlist/<token>/live/<id>` skip YouTube links (channel left out of the M3U when it has no other link); health cron treats YouTube links as live. Tested locally on a temporary dev page (deleted before commit): all three play, bad YouTube link fails over to HLS, plain HLS unaffected, local M3U builds with no YouTube links. Production build of the clean commit passed; pushed `928e91c` to master; Dokploy build 2026-11-13T154836Z. Verified new code live via the smart redirect skipping YouTube.
- Data: `channel_sources` 3234/3235/3236 (label `youtube-official`, priority -10, URLs `https://www.youtube.com/channel/<UC…>/live`); audio-only sources 1758, 1730, 2591 deactivated; channels 862, 12, 902 set LIVE with `stream_url` = YouTube URL. Backups `backups/youtube-sources-added-2026-11-13.json`, `backups/youtube-golive-before-2026-11-13.json`. `/watch/862-ntv`, `/watch/12-atn-news`, `/watch/902-channel-24` return 200.
- Not verified: logged-in playback on production and on phones (iPhone autoplay may need a tap). The skill (`.claude/skills/playlist-import/SKILL.md`) records the YouTube rule and channel ids.
