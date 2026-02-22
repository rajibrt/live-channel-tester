import { NextResponse } from "next/server";
import { requireAdminApi } from "../../../../../../lib/adminApi";
import { getSupabaseAdmin } from "../../../../../../lib/supabaseAdmin";

export const runtime = "nodejs";

function safeNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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
    const reason = e?.name === "AbortError" ? "timeout" : `error_${e?.name || "unknown"}`;
    return { isLive: false, reason };
  } finally {
    clearTimeout(timer);
  }
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function POST(request, { params }) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  try {
    const { slug } = await params;
    const playlistSlug = String(slug || "").trim().toLowerCase();
    if (!playlistSlug) {
      return NextResponse.json({ error: "Invalid playlist slug." }, { status: 400 });
    }
    const body = await request.json().catch(() => ({}));
    const timeout = Math.max(1, safeNumber(body.timeout, 8));
    const maxItems = Math.max(0, Math.floor(safeNumber(body.max_items, 0)));
    const concurrency = Math.max(1, Math.min(12, Math.floor(safeNumber(body.concurrency, 6))));

    const supabase = getSupabaseAdmin();
    const { data: links, error: linksErr } = await supabase
      .from("playlist_channels")
      .select("channel_id,position")
      .eq("playlist_slug", playlistSlug)
      .order("position", { ascending: true });
    if (linksErr) {
      return NextResponse.json({ error: linksErr.message }, { status: 500 });
    }
    const ids = (links || []).map((x) => x.channel_id).filter(Boolean);
    if (!ids.length) {
      return NextResponse.json({ total: 0, live_count: 0, dead_count: 0, items: [] });
    }

    const { data: channels, error: chErr } = await supabase
      .from("channels")
      .select("id,name,category,stream_url,status")
      .in("id", ids);
    if (chErr) {
      return NextResponse.json({ error: chErr.message }, { status: 500 });
    }

    const byId = Object.fromEntries((channels || []).map((c) => [c.id, c]));
    let items = (links || [])
      .map((l) => {
        const c = byId[l.channel_id];
        if (!c) return null;
        return {
          id: Number(c.id),
          name: String(c.name || "Stream"),
          category: String(c.category || ""),
          url: String(c.stream_url || "").trim(),
          status_before: String(c.status || "LIVE").toUpperCase(),
          position: Number(l.position || 0),
        };
      })
      .filter((x) => x && x.url);

    if (maxItems > 0) items = items.slice(0, maxItems);

    const results = [];
    for (const part of chunk(items, concurrency)) {
      const checked = await Promise.all(
        part.map(async (item) => {
          const probe = await checkStream(item.url, timeout);
          return {
            ...item,
            check_status: probe.isLive ? "LIVE" : "DEAD",
            reason: probe.reason,
          };
        })
      );
      results.push(...checked);
    }

    const liveCount = results.filter((x) => x.check_status === "LIVE").length;
    const deadCount = results.length - liveCount;
    return NextResponse.json({
      total: results.length,
      live_count: liveCount,
      dead_count: deadCount,
      items: results,
    });
  } catch (error) {
    return NextResponse.json({ error: error?.message || "Failed to run playlist health check." }, { status: 500 });
  }
}

