---
name: playlist-import
description: Add TV channels or links from a playlist, M3U, capture or link list to webtvbd.com (also planned for radio stations and movie lists). Use whenever the user gives a playlist/link file and says add it, যুক্ত করো, অ্যাড করো, import, or asks for backup links, dead-link cleanup or black/no-signal channel checks.
---

# Playlist / link import (TV now; radio and movies next)

This skill is the knowledge base for this work. Read it before doing any work when the user gives a playlist, M3U, capture or link list and says
"add it", "যুক্ত করো", "অ্যাড করো ওয়েবসাইটে" or similar. It applies to any AI agent (Claude, Gemini,
ChatGPT, …). Follow the steps in order; do not skip the review step.

Scope today: **TV channels** (playlist `bdix`). Planned next with the same method: **radio stations**
(`radio_stations` / `radio_station_sources`) and **movie lists** (`movies` / `movie_sources`). See
"Radio and movies" at the end. When the user changes any instruction about this work, update this file in
the same task and add a line to the change log at the bottom.

Last updated: 2026-11-13.

---

## 1. Ground rules (from the user)

1. **Trace the real link first.** Many lists contain redirect/wrapper links (e.g. `go.skym3u.dev/live/...`).
   Resolve each one with a player User-Agent (`VLC/3.0.20 LibVLC/3.0.20`; Cloudflare blocks curl's
   default UA) following `Location` headers until the host is no longer the wrapper. Store the **real**
   upstream URL, never the wrapper.
2. **Test from the user's own network.** Most viewers are on Bangladeshi ISPs; the production server
   (Hetzner) cannot reach BDIX/ISP-local hosts. Run all probes on the user's Mac.
3. **"Plays" is not enough.** A link must show a real picture. Reject/disable links that:
   - are **audio-only** (master playlist CODECS has only `mp4a`, or ffprobe shows no video stream) →
     black screen with sound (this was the cause of black NTV / ATN News / Channel 24 on 2026-11-12);
   - show a **slate**: "No signal", colour bars, test card, "channel unavailable", "invalid key",
     "service will launch soon", a permanent black/dark card, a "please go to <other site>" card;
   - are VOD loops pretending to be live (one short segment + `#EXT-X-ENDLIST`).
   A temporary ad-break card is not a reason to reject.
4. **Existing channel → backup link.** If the channel already exists, add the new link to
   `channel_sources` (only if that URL is not already there). Do not create "Name 2" copies.
5. **New channel only when it is wanted.** Bangladeshi, Indian Bangla, Hindi, Indian regional,
   Pakistani, Islamic, mainstream kids/sports/documentary. Skip unbranded/generic names
   ("Channel 155", "Stream 12"), Western FAST filler (Red Bull regional copies, XITE, Rakuten,
   Stingray, Fashion TV, …), and duplicates.
6. **Dead links go to the bottom.** For channels with several links, keep working links first (admin
   order), new links next, then links that fail from the user's network (keep them active — they may
   work on other ISPs). Audio-only and slate links are deactivated (`is_active=false`).
7. **Channels with no working link:** delete unbranded/unnecessary ones and ones added recently that
   already died; mark branded ones `status='DEAD'` (hidden; easy to bring back).
8. **Skip tokenized links** that expire (base64 path `app24.jagobd.com.bd/c3Vy…`,
   `app.ncare.live/c3Vy…`, `rutube.ru`, links with `?e=<expiry>&u=…` tokens) and links from IPTV
   resellers' private panels.
9. **Review before writing.** Present the plan (counts + CSV in `backups/imports/`) and wait for the
   user's explicit approval. Local and production share one Supabase DB, so every write is live
   immediately.
10. **Back up before applying**, record ids of everything added/removed, and write a ledger entry in
    `AGENTS.md`. Never commit `backups/` (user data; git-excluded).
11. Admin UI text is English; replies to the user may be Bengali.

## 2. Data model (TV)

- `channels` (id, playlist_slug, name, category, logo_url NOT NULL — use `''`, stream_url UNIQUE NOT
  NULL, status `LIVE`/`DEAD`, include_on_home). Keep `channels.id` stable (favourites, history,
  `/watch/<id>-slug`, analytics).
- `channel_sources` (channel_id, stream_url, label, priority — lower plays first, is_active,
  success/failure counters reported by viewers' players). Unique on (channel_id, stream_url).
  `channels.stream_url` must equal the top active source (it is what old clients and single-link
  M3U entries use). Updating it can fail on the UNIQUE constraint if another channel already uses that
  URL — leave it and note the duplicate.
- `playlist_channels` (playlist_slug, channel_id, position) — membership + order.
- `playlist_groups` (playlist_slug, name, position) — category order. Current 16 categories, in order:
  Bangla, Bangla News, Indian Bangla, Hindi, Indian Regional, English News, English Movies,
  Entertainment, Sports, Kids, Music, Documentary, Religious, International (incl. Pakistani),
  Thailand, Radio. Do not invent new categories without asking.
- `admin_settings.channel_merges` — old→kept id map for merged duplicates.
- Source `label` values used so far: `primary`, `WalaTV`, `iptv-org`, `skym3u`, `sky`, `merged: <name>`.

## 3. Tools (in `vercel/scripts/channel-import/`)

All scripts take a work directory `$W` (use a scratch folder, never the repo). Layout:
`$W/in/<playlist>.m3u`, `$W/work/*.json`, `$W/frames/`, `$W/sheets/`. Python needs Pillow only for the
contact sheet (`python3 -m venv $W/venv && $W/venv/bin/pip install pillow`). Node scripts that touch
the DB must run from `vercel/` with `node --env-file=.env.local` (copy the script next to
`node_modules` or run it from `vercel/` so `@supabase/supabase-js` resolves).

| Step | Script | Output |
|---|---|---|
| Parse M3U + resolve wrapper redirects | `01-parse-resolve.mjs <m3u> $W/work/resolved.json` | real URLs |
| HLS probe (master → variant → last segment) | `02-probe.mjs <items.json> <out.json> 16` | ok / gone / blocked / unreachable + height |
| Dump bdix channels, sources, groups, all URLs | `03-dump-db.mjs $W/work/db.json` | DB snapshot |
| Name matching (normalised; numbered series kept) | `04a-match.py $W`, `04b-match.py $W` | `match2.json` |
| Frame grab + luminance | `05-grab-frames.py <items> <out> $W/frames` | jpg + YAVG |
| ffprobe streams for links without a frame | `06-ffprobe-streams.py <in> <out>` | audio-only detection |
| Master CODECS audio-only / HEVC check | `07-audio-only-check.mjs $W` | `aonly.json` |
| Contact sheets for eye review | `08-contact-sheet.py $W <src|sky> <outbase> [keys.json]` | 6×6 jpg grids |
| Build plan (backups, new channels, reorder, dead) | `09-plan.py $W` + `newmap.py` | `plan.json` |
| Apply (backup first, logs everything) | `10-apply.mjs $W <backup.json>` | `…-applied-….json` |
| Remove slate/black links found after review | `11-remove-bad-links.mjs` | log json |

`newmap.py` holds this run's decisions: `NEW` (name key → display name + category, or `=<id>` to map
onto an existing channel), `EXTRA_MATCH` (manual fixes / `None` = skip ambiguous), `SKIP_HOST_RE`
(tokenized hosts). Review and extend it for each new playlist. `work/slate.json` lists keys judged bad
by eye.

## 4. Procedure

1. Read `AGENTS.md` (start procedure) and this file. Copy the input file into git-excluded
   `backups/imports/<name>-<date>.m3u`.
2. Resolve wrapper links (step 1). De-duplicate by real URL; count duplicate entries.
3. Probe all real links and **all existing active sources of the playlist** from the user's network.
4. Dump the DB; mark which links are already known (`channels.stream_url` or any `channel_sources`).
5. Match names to existing channels; fix ambiguous matches by hand; map wanted unmatched names to
   new channels with a category.
6. Frame-grab every candidate link and every working existing link; ffprobe the ones without a
   frame; run the CODECS check. Look at the contact sheets yourself and add slates to `slate.json`.
   Confirm identity (logo on screen) at least for Bangla / Bangla News / Indian Bangla.
7. Build the plan (max 3 new links per existing channel, higher resolution first; a new link goes
   first only when no current link works). Write `backups/imports/<name>-review-<date>.csv` and show
   the user a summary: existing-channel matches, duplicates, backup links per channel, new channels,
   links moved down/deactivated, channels to delete / mark DEAD.
8. On approval: run `10-apply.mjs` (it backs up bdix links, channels, sources, other-playlist links
   and groups to `backups/bdix-full-before-<name>-<date>.json` first).
9. Verify: counts in DB, `/watch/<id>` of a few changed channels returns 200, M3U still builds.
10. Final summary to the user (see §5) + `AGENTS.md` ledger entry.

## 5. Final summary the user wants

Always end with:
- how many playlist channels **already existed** on the site;
- how many **duplicate links** (repeated inside the playlist, and already present in our DB);
- how many links were added **as backup (second) links**, to how many channels, with details
  (per channel: name + number of links; which were placed first);
- how many **new channels** were created (name, category, number of links);
- links moved down / deactivated, channels deleted / marked DEAD;
- anything not verified.

## 6. Lessons learned

- aynaott (`tvsen*.aynaott.com`) links come and go: on 2026-11-12/13 ~30 US channels added one day
  were 404 the next, and several BD channels' streams dropped their video (audio-only). Re-probe
  regularly; prefer non-aynaott links when equal.
- Master playlists can mislabel CODECS; a frame from ffmpeg overrides the CODECS check.
- ffmpeg rejects some HLS segment extensions; use `-extension_picky 0 -allowed_extensions ALL`
  before declaring a link dead.
- Viewer success counters say only that playback started; an audio-only link still counts as a
  success, so never trust counters over a frame check.
- Slates seen so far (reject them): OTTCLUB "Неверный ключ" (invalid key), fox picture "КАНАЛ
  НЕДОСТУПЕН" (channel unavailable — Polsat, Canal+, Eleven, Eurosport PL restreams), "Превышено
  допустимое количество устройств" (device limit), "Subscription required", "This live stream has
  ended", "No signal!" (ATN), colour bars (pishow/ektv "Maha" channels, Sindh TV), test card
  "NO SIGNAL" (Somoy, Duronto), "INDIASIGN will launch soon", ghuddi "please go to ghuddi.tv", and
  constant black frames (YAVG exactly 16 for every sampled frame).
- `11-remove-bad-links.mjs <urls.json> <ids.json> <out.json> dry|apply` deactivates bad links, moves
  `channels.stream_url` to the next active link, and deletes (from bdix; row only if in no other
  playlist) or marks DEAD a channel left with no active link.
- **Official YouTube live as a source** (needs the YouTube-capable player, `lib/youtubeSource.js`):
  when a channel has no working HLS link with video, check the channel's official website — NTV,
  ATN News and Channel 24 embed YouTube. Store the channel's always-on URL
  `https://www.youtube.com/channel/<UC…>/live` (label `youtube-official`); the player shows YouTube's
  own embed and fails over on embed errors. Never extract the stream behind a YouTube video. YouTube
  links are left out of the M3U (IPTV apps cannot play them) and are skipped by the health cron.
  Known ids: NTV `UC0V3IJCnr6ZNjB9t_GLhFFA` (@NTVDigitalLive), ATN News `UC9Rgo0CrNyd7OWliLekqqGA`
  (@atnnewsltd), Channel 24 `UCHLqIOMPk20w-6cFgkA90jw` (@channel24digital).
- Name-only matching fails for short names ("S", "Zee", "Colors", "Time"); map those by hand.

## 7. Radio and movies (planned, same method)

- **Radio:** tables `radio_stations` (region group) and `radio_station_sources` (ordered links,
  viewer counters). Checks: stream answers with audio (`ffprobe` codec mp3/aac), CORS header (needed
  for the live spectrum), HTTPS preferred. Identity by stream metadata / station site. No frame check.
- **Movies (started 2026-11-13):** tables `movies` / `movie_sources` (ordered by `sort_order`, many
  links per movie). The player (`components/movies/MoviePlayer.js`) tries the links in order, moves
  links with known browser-unplayable audio or unreachable status (`movie_source_media_info`) to the
  end, fails over on error / 20 s without a frame / no decoded audio after ~4 s, and resumes at the
  same position. Admin movie form: "Main link" + "Backup links" (`MovieBackupLinks.js`); the save API
  (`lib/movieSourcesAdmin.js`) stores the exact ordered list and never drops other links on a
  single-link save.
  - Servers reachable from the user's network (2026-11-13): Discovery FTP `https://cdn1.discoveryftp.net/Movies/…`,
    DhakaFlix `http://172.16.50.7/DHAKA-FLIX-7/…` and `http://172.16.50.14/DHAKA-FLIX-14/…` (h5ai),
    FTPBD `https://server2|3|5.ftpbd.net/FTP-n/…` (Apache; `_reencoded.mp4` files are h264 + AAC),
    cinehub24 `http://cinehub24.com/ftp/Movies/…`, Circle FTP `http://index.circleftp.net/FILE/…`.
    Not usable: ICC FTP 10.16.100.244 (firewall login), 10.1.1.1 (no listing), dhakaflix.com (parked).
    These are BDIX servers: reachable from most BD ISPs, but only the user's ISP was tested.
  - Scripts `vercel/scripts/movie-import/`: `01-crawl-index.mjs` (directory listings → file list),
    `02-dump-movies.mjs`, `03-match.py` (normalised title + year from file or folder name; skips
    samples/episodes, ambiguous matches and URLs already stored), `04-probe.py` (range request +
    ffprobe: video codec/height, audio codecs, duration; resumable), `05-select.py` (max 4 new links
    per movie, one per new server first, no 4K, no files under 40 min, browser-audio + h264 preferred;
    order = existing playable, new browser-audio, other new, existing bad-audio).
  - Do not add a URL that is already stored for that movie. Present the review CSV before writing.
- When starting either, extend this file with its own section and scripts.

## Change log

- 2026-11-13: movies — multi-link player/admin, BDIX server list, movie-import scripts.

- 2026-11-13: official YouTube live sources (rule + channel ids).

- 2026-11-13: created after the sky.m3u import (rules from the user: trace real links, backup links
  for existing channels, dead links to the bottom, remove/mark DEAD channels without a working link,
  reject black/no-signal/permission slates, final summary format, cover radio and movies next).
