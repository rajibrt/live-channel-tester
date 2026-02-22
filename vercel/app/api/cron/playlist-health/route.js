import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../../lib/supabaseAdmin";

export const runtime = "nodejs";

function safeInt(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function checkStream(url, timeoutSec) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1, timeoutSec) * 1000);
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      cache: "no-store",
      signal: controller.signal,
    });

    if (!res.ok) {
      return { isLive: false, reason: `http_${res.status}` };
    }

    const contentType = String(res.headers.get("content-type") || "").toLowerCase();
    const text = await res.text();
    const trimmed = text.trimStart();
    if (
      trimmed.startsWith("#EXTM3U") ||
      trimmed.includes("#EXTINF") ||
      contentType.includes("mpegurl") ||
      contentType.includes("vnd.apple.mpegurl") ||
      contentType.startsWith("video/") ||
      contentType.startsWith("audio/")
    ) {
      return { isLive: true, reason: "ok" };
    }
    return { isLive: false, reason: "not_playlist" };
  } catch (e) {
    return {
      isLive: false,
      reason: e?.name === "AbortError" ? "timeout" : `error_${e?.name || "unknown"}`,
    };
  } finally {
    clearTimeout(timer);
  }
}

function isCronAuthorized(request) {
  const cronSecret = process.env.CRON_SECRET || "";
  if (!cronSecret) return false;
  const authHeader = String(request.headers.get("authorization") || "");
  if (authHeader === `Bearer ${cronSecret}`) return true;
  const secretInQuery = new URL(request.url).searchParams.get("secret") || "";
  return secretInQuery === cronSecret;
}

async function runPlaylistHealthJob({ timeout, concurrency, limit }) {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  const { data: refs, error: refsErr } = await supabase
    .from("playlist_channels")
    .select("channel_id");
  if (refsErr) {
    throw new Error(`Failed loading playlist channels: ${refsErr.message}`);
  }

  const channelIds = [...new Set((refs || []).map((r) => Number(r.channel_id)).filter((id) => Number.isFinite(id)))];
  if (!channelIds.length) {
    return {
      total_checked: 0,
      live_count: 0,
      dead_count: 0,
      updated_live: 0,
      updated_dead: 0,
      reason: "No playlist channels found.",
    };
  }

  let selectedIds = channelIds;
  if (limit > 0) selectedIds = channelIds.slice(0, limit);

  let channels = [];
  for (const idsPart of chunk(selectedIds, 500)) {
    const { data, error } = await supabase
      .from("channels")
      .select("id,stream_url,status")
      .in("id", idsPart);
    if (error) {
      throw new Error(`Failed loading channels: ${error.message}`);
    }
    channels.push(...(data || []));
  }

  channels = channels.filter((c) => String(c.stream_url || "").trim());
  const results = [];
  for (const part of chunk(channels, concurrency)) {
    const checked = await Promise.all(
      part.map(async (channel) => {
        const probe = await checkStream(channel.stream_url, timeout);
        return {
          id: Number(channel.id),
          statusBefore: String(channel.status || "LIVE").toUpperCase(),
          statusAfter: probe.isLive ? "LIVE" : "DEAD",
          reason: probe.reason,
        };
      })
    );
    results.push(...checked);
  }

  const liveIds = results.filter((r) => r.statusAfter === "LIVE").map((r) => r.id);
  const deadIds = results.filter((r) => r.statusAfter === "DEAD").map((r) => r.id);

  let updatedLive = 0;
  let updatedDead = 0;
  for (const part of chunk(liveIds, 300)) {
    if (!part.length) continue;
    const { data, error } = await supabase
      .from("channels")
      .update({ status: "LIVE", updated_at: now })
      .in("id", part)
      .select("id");
    if (error) throw new Error(`Failed updating LIVE channels: ${error.message}`);
    updatedLive += (data || []).length;
  }

  for (const part of chunk(deadIds, 300)) {
    if (!part.length) continue;
    const { data, error } = await supabase
      .from("channels")
      .update({ status: "DEAD", updated_at: now })
      .in("id", part)
      .select("id");
    if (error) throw new Error(`Failed updating DEAD channels: ${error.message}`);
    updatedDead += (data || []).length;
  }

  return {
    total_checked: results.length,
    live_count: liveIds.length,
    dead_count: deadIds.length,
    updated_live: updatedLive,
    updated_dead: updatedDead,
  };
}

async function writeJobRunLog(payload) {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const row = {
    job_name: "playlist_health_hourly",
    last_run_at: now,
    last_status: String(payload?.status || "ok"),
    last_message: String(payload?.message || ""),
    last_total: Number(payload?.total_checked || 0),
    last_live: Number(payload?.live_count || 0),
    last_dead: Number(payload?.dead_count || 0),
    updated_at: now,
  };
  if (typeof payload?.is_enabled === "boolean") {
    row.is_enabled = payload.is_enabled;
  }
  const { error } = await supabase.from("job_runs").upsert(row, { onConflict: "job_name" });
  if (error) {
    throw new Error(`Failed writing job log: ${error.message}`);
  }
}

async function getCronEnabledState() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("job_runs")
    .select("is_enabled")
    .eq("job_name", "playlist_health_hourly")
    .maybeSingle();
  if (error) {
    throw new Error(`Failed reading cron state: ${error.message}`);
  }
  if (!data || typeof data.is_enabled !== "boolean") return true;
  return data.is_enabled;
}

export async function GET(request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const isEnabled = await getCronEnabledState();
    if (!isEnabled) {
      await writeJobRunLog({
        status: "paused",
        message: "Skipped: cron is turned off from dashboard.",
        total_checked: 0,
        live_count: 0,
        dead_count: 0,
        is_enabled: false,
      });
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: "cron_disabled",
      });
    }

    const url = new URL(request.url);
    const timeout = safeInt(
      url.searchParams.get("timeout") || process.env.CRON_CHECK_TIMEOUT_SEC,
      8,
      1,
      20
    );
    const concurrency = safeInt(
      url.searchParams.get("concurrency") || process.env.CRON_CHECK_CONCURRENCY,
      6,
      1,
      20
    );
    const limit = safeInt(
      url.searchParams.get("limit") || process.env.CRON_CHECK_LIMIT,
      0,
      0,
      5000
    );

    const result = await runPlaylistHealthJob({ timeout, concurrency, limit });
    await writeJobRunLog({
      status: "ok",
      message: "Hourly playlist health check completed.",
      is_enabled: true,
      ...result,
    });
    return NextResponse.json({
      ok: true,
      schedule: "hourly",
      timeout,
      concurrency,
      limit,
      ...result,
    });
  } catch (error) {
    try {
      await writeJobRunLog({
        status: "error",
        message: error?.message || "Failed to run playlist health cron job.",
      });
    } catch (_logErr) {
      // avoid masking original error response
    }
    return NextResponse.json(
      { error: error?.message || "Failed to run playlist health cron job." },
      { status: 500 }
    );
  }
}
