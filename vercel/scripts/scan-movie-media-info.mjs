// Probe every active movie source with ffprobe and store codecs in
// public.movie_source_media_info (see supabase/movie_media_info.sql).
//
// Must run on a computer inside the ISP network (sources are private
// BDIX FTP hosts such as cdn1.discoveryftp.net -> 172.16.16.10), with ffprobe
// installed. Usage (from vercel/):
//   node --env-file=.env.local scripts/scan-movie-media-info.mjs [--force] [--limit=N] [--concurrency=4] [--include-hls] [--max-age-days=30]
//
// Already-probed URLs newer than --max-age-days are skipped unless --force.
import { createClient } from "@supabase/supabase-js";
import { spawn } from "node:child_process";

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name, fallback) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=").slice(1).join("=") : fallback;
};
const FORCE = flag("force");
const INCLUDE_HLS = flag("include-hls");
const LIMIT = Number(opt("limit", 0)) || 0;
const CONCURRENCY = Math.max(1, Math.min(8, Number(opt("concurrency", 4)) || 4));
const MAX_AGE_DAYS = Math.max(0, Number(opt("max-age-days", 30)) || 30);
const FFPROBE = process.env.FFPROBE_PATH || "ffprobe";
const PROBE_TIMEOUT_MS = 25000;

// Audio codecs Chrome / Android WebView can decode in <video>.
const BROWSER_AUDIO_CODECS = new Set(["aac", "mp3", "opus", "vorbis", "flac", "alac", "pcm_s16le", "pcm_s24le", "pcm_f32le", "pcm_u8"]);

const admin = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function fetchAll(table, columns, build = (q) => q) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(admin.from(table).select(columns)).range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

function runFfprobe(url) {
  return new Promise((resolve) => {
    const child = spawn(FFPROBE, [
      "-v", "error",
      "-rw_timeout", "15000000",
      "-show_entries", "format=format_name,duration:stream=codec_type,codec_name",
      "-of", "json",
      url,
    ], { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    const timer = setTimeout(() => child.kill("SIGKILL"), PROBE_TIMEOUT_MS);
    child.stdout.on("data", (c) => { out += c; });
    child.stderr.on("data", (c) => { err += c; });
    child.on("error", (e) => { clearTimeout(timer); resolve({ ok: false, error: String(e.message || e) }); });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) return resolve({ ok: false, error: (err || `ffprobe exit ${code}`).trim().slice(-300) });
      try { resolve({ ok: true, json: JSON.parse(out || "{}") }); }
      catch { resolve({ ok: false, error: "ffprobe returned invalid JSON" }); }
    });
  });
}

async function headStatus(url) {
  try {
    const res = await fetch(url, { method: "GET", headers: { Range: "bytes=0-0" }, signal: AbortSignal.timeout(10000) });
    try { await res.body?.cancel(); } catch { /* ignore */ }
    return res.status;
  } catch {
    return null;
  }
}

async function probe(url) {
  const result = await runFfprobe(url);
  const base = { source_url: url, probed_at: new Date().toISOString() };
  if (!result.ok) {
    const http = await headStatus(url);
    const unreachable = http === null || http >= 400;
    return { ...base, status: unreachable ? "unreachable" : "error", http_status: http, error: result.error, audio_codecs: [], browser_audio_ok: null };
  }
  const streams = Array.isArray(result.json?.streams) ? result.json.streams : [];
  const audio = [...new Set(streams.filter((s) => s.codec_type === "audio").map((s) => String(s.codec_name || "").toLowerCase()).filter(Boolean))];
  const video = streams.find((s) => s.codec_type === "video")?.codec_name || null;
  const duration = Math.round(Number(result.json?.format?.duration || 0)) || null;
  return {
    ...base,
    status: "ok",
    http_status: null,
    container: String(result.json?.format?.format_name || "").slice(0, 60) || null,
    video_codec: video,
    audio_codecs: audio,
    browser_audio_ok: audio.length ? audio.some((c) => BROWSER_AUDIO_CODECS.has(c)) : null,
    duration_seconds: duration,
    error: null,
  };
}

async function main() {
  const sources = await fetchAll("movie_sources", "source_url", (q) => q.eq("is_active", true).order("id"));
  let urls = [...new Set(sources.map((r) => String(r.source_url || "").trim()).filter((u) => /^https?:\/\//i.test(u)))];
  if (!INCLUDE_HLS) urls = urls.filter((u) => !/\.m3u8(\?|$)/i.test(u));

  if (!FORCE) {
    const known = await fetchAll("movie_source_media_info", "source_url,probed_at,status");
    const cutoff = Date.now() - MAX_AGE_DAYS * 86400000;
    const fresh = new Set(known.filter((r) => r.status !== "error" && new Date(r.probed_at).getTime() >= cutoff).map((r) => r.source_url));
    urls = urls.filter((u) => !fresh.has(u));
  }
  if (LIMIT) urls = urls.slice(0, LIMIT);
  console.log(`To probe: ${urls.length} URLs (concurrency ${CONCURRENCY})`);

  const stats = { ok: 0, unreachable: 0, error: 0, noBrowserAudio: 0 };
  const audioCount = {};
  let pending = [];
  let done = 0;
  const flush = async () => {
    if (!pending.length) return;
    const batch = pending;
    pending = [];
    const { error } = await admin.from("movie_source_media_info").upsert(batch, { onConflict: "source_url" });
    if (error) throw new Error(`upsert failed: ${error.message}`);
  };

  let index = 0;
  const worker = async () => {
    while (index < urls.length) {
      const url = urls[index++];
      const row = await probe(url);
      stats[row.status] += 1;
      if (row.browser_audio_ok === false) stats.noBrowserAudio += 1;
      for (const c of row.audio_codecs || []) audioCount[c] = (audioCount[c] || 0) + 1;
      pending.push(row);
      done += 1;
      if (pending.length >= 50) await flush();
      if (done % 100 === 0) console.log(`${done}/${urls.length}`, JSON.stringify(stats));
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  await flush();
  console.log("DONE", JSON.stringify(stats), "audio codecs:", JSON.stringify(audioCount));
}

main().catch((e) => { console.error(e); process.exit(1); });
