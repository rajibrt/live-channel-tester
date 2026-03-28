import { NextResponse } from "next/server";
import { requireAdminApi } from "../../../../../../lib/adminApi";
import { getSupabaseAdmin } from "../../../../../../lib/supabaseAdmin";
import { normalizeStreamUrl } from "../../../../../../lib/streamUrl";

export const runtime = "nodejs";
const PAGE_SIZE = 1000;

function normalizeBaseUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function isLoopbackBaseUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return false;
  try {
    const u = new URL(raw);
    const host = String(u.hostname || "").toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return false;
  }
}

function safeNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseBoolean(value, fallback = true) {
  if (typeof value === "boolean") return value;
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return fallback;
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

function sanitizeAttr(value) {
  return String(value || "").replace(/"/g, "'").trim();
}

function buildPlaylistText(items) {
  const lines = ["#EXTM3U", ""];
  items.forEach((item) => {
    const safeName = sanitizeAttr(item.name || "Stream");
    const attrs = [`tvg-name="${safeName}"`];
    if (item.category) attrs.push(`group-title="${sanitizeAttr(item.category)}"`);
    if (item.logo_url) attrs.push(`tvg-logo="${sanitizeAttr(item.logo_url)}"`);
    lines.push(`#EXTINF:-1 ${attrs.join(" ")},${safeName}`);
    lines.push(item.url);
  });
  return `${lines.join("\n")}\n`;
}

async function fetchAllPlaylistLinks(supabase, playlistSlug) {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("playlist_channels")
      .select("channel_id,position")
      .eq("playlist_slug", playlistSlug)
      .order("position", { ascending: true })
      .range(from, to);
    if (error) throw error;
    const batch = Array.isArray(data) ? data : [];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return rows;
}

async function fetchChannelsByIds(supabase, ids) {
  const rows = [];
  const uniqueIds = [...new Set((ids || []).filter(Boolean))];
  for (let i = 0; i < uniqueIds.length; i += PAGE_SIZE) {
    const part = uniqueIds.slice(i, i + PAGE_SIZE);
    const { data, error } = await supabase
      .from("channels")
      .select("id,name,category,logo_url,stream_url,status")
      .in("id", part);
    if (error) throw error;
    rows.push(...(data || []));
  }
  return rows;
}

function transformEvent(raw, urlMap, meta) {
  let evt = null;
  try {
    evt = JSON.parse(raw);
  } catch {
    return "";
  }
  if (!evt || typeof evt !== "object") return "";

  const startIndex = Number(meta?.startIndex || 0);
  const originalTotal = Number(meta?.originalTotal || 0);

  if (evt.type === "start") {
    evt.total = originalTotal || Number(evt.total || 0);
    evt.remaining = Number(evt.total || 0);
    evt.start_index = startIndex;
  }

  if (evt.type === "item" || evt.type === "current") {
    evt.index = startIndex + Number(evt.index || 0);
    evt.total = originalTotal || Number(evt.total || 0);
    const normalizedUrl = normalizeStreamUrl(evt.url || "");
    const matched = normalizedUrl ? urlMap.get(normalizedUrl) : null;
    if (matched) {
      evt.id = matched.id;
      evt.name = matched.name;
      evt.category = matched.category;
      evt.logo_url = matched.logo_url;
      evt.status_before = matched.status_before;
      evt.position = matched.position;
    }
  }

  if (evt.type === "complete") {
    evt.total = originalTotal || Number(evt.total || 0);
    evt.start_index = startIndex;
  }

  return `${JSON.stringify(evt)}\n`;
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
    const agentBaseUrl = normalizeBaseUrl(
      body.agent_base_url || process.env.LOCAL_AGENT_BASE_URL || "http://127.0.0.1:8787"
    );
    const timeout = Math.max(1, safeNumber(body.timeout, 8));
    const hardTimeout = Math.max(1, safeNumber(body.hard_timeout, Math.max(timeout + 6, 15)));
    const delay = Math.max(0, safeNumber(body.delay, 0));
    const maxItems = Math.max(0, Math.floor(safeNumber(body.max_items, 0)));
    const startIndex = Math.max(0, Math.floor(safeNumber(body.start_index, 0)));
    const verifySegment = parseBoolean(body.verify_segment, true);
    const groupName = String(body.group || "").trim();

    if (!agentBaseUrl || !/^https?:\/\//i.test(agentBaseUrl)) {
      return NextResponse.json({ error: "agent_base_url must be a valid http/https URL." }, { status: 400 });
    }

    const requestHost = String(request.nextUrl?.hostname || "").toLowerCase();
    const isHostedRequest =
      !!requestHost && requestHost !== "localhost" && requestHost !== "127.0.0.1" && requestHost !== "::1";
    if (isHostedRequest && isLoopbackBaseUrl(agentBaseUrl)) {
      return NextResponse.json(
        {
          error:
            "Local Agent Base URL uses localhost/127.0.0.1, which is unreachable from hosted server. Use a public/local-network reachable agent URL.",
        },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const links = await fetchAllPlaylistLinks(supabase, playlistSlug);

    const ids = (links || []).map((x) => x.channel_id).filter(Boolean);
    if (!ids.length) {
      return NextResponse.json({ total: 0, live_count: 0, dead_count: 0, items: [] });
    }

    const channels = await fetchChannelsByIds(supabase, ids);

    const byId = new Map((channels || []).map((c) => [c.id, c]));
    let items = (links || [])
      .map((link) => {
        const channel = byId.get(link.channel_id);
        if (!channel) return null;
        const url = normalizeStreamUrl(channel.stream_url || "");
        if (!url) return null;
        return {
          id: Number(channel.id),
          name: String(channel.name || "Stream"),
          category: String(channel.category || ""),
          logo_url: String(channel.logo_url || ""),
          url,
          status_before: String(channel.status || "LIVE").toUpperCase(),
          position: Number(link.position || 0),
        };
      })
      .filter(Boolean);

    if (groupName) {
      items = items.filter((item) => String(item.category || "").trim() === groupName);
    }

    const originalTotal = items.length;
    items = maxItems > 0 ? items.slice(startIndex, startIndex + maxItems) : items.slice(startIndex);
    if (!items.length) {
      return NextResponse.json({
        total: 0,
        original_total: originalTotal,
        start_index: startIndex,
        live_count: 0,
        dead_count: 0,
        group: groupName,
        items: [],
      });
    }

    const playlistText = buildPlaylistText(items);
    const form = new FormData();
    form.append("playlist", new Blob([playlistText], { type: "audio/x-mpegurl" }), `${playlistSlug}.m3u`);
    form.append("timeout", String(timeout));
    form.append("hard_timeout", String(hardTimeout));
    form.append("delay", String(delay));
    form.append("max_items", String(maxItems));
    form.append("verify_segment", verifySegment ? "true" : "false");

    let agentResponse;
    try {
      agentResponse = await fetch(`${agentBaseUrl}/api/test-stream`, {
        method: "POST",
        body: form,
        cache: "no-store",
      });
    } catch {
      return NextResponse.json(
        {
          error: `Failed to reach local agent at ${agentBaseUrl}. Start it with: python3 -m uvicorn local_agent:app --host 127.0.0.1 --port 8787`,
        },
        { status: 502 }
      );
    }

    if (!agentResponse.ok) {
      const text = (await agentResponse.text().catch(() => "")).slice(0, 500);
      return NextResponse.json(
        { error: `Local agent request failed. HTTP ${agentResponse.status}${text ? `: ${text}` : ""}` },
        { status: 502 }
      );
    }
    if (!agentResponse.body) {
      return NextResponse.json({ error: "Local agent returned no response body." }, { status: 502 });
    }

    const urlMap = new Map(items.map((item) => [item.url, item]));
    const streamMeta = { startIndex, originalTotal };
    const reader = agentResponse.body.getReader();
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        let buffer = "";
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";
            for (const line of lines) {
              const raw = line.trim();
              if (!raw) continue;
              const payload = transformEvent(raw, urlMap, streamMeta);
              if (payload) controller.enqueue(encoder.encode(payload));
            }
          }

          const tail = buffer.trim();
          if (tail) {
            const payload = transformEvent(tail, urlMap, streamMeta);
            if (payload) controller.enqueue(encoder.encode(payload));
          }
          controller.close();
        } catch {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "content-type": "application/x-ndjson; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error?.message || "Failed to run playlist health check." }, { status: 500 });
  }
}
