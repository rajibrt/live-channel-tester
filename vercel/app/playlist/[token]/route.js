import { createClient } from "@supabase/supabase-js";

function m3uHeader() {
  return "#EXTM3U\n\n";
}

function sanitizeAttr(value) {
  return (value || "").replaceAll('"', "'").trim();
}

function normalizeTokenParam(rawToken) {
  const value = String(rawToken || "").trim();
  if (!value) return "";
  return value.toLowerCase().endsWith(".m3u") ? value.slice(0, -4) : value;
}

export async function GET(_request, context) {
  const { token } = await context.params;
  const normalizedToken = normalizeTokenParam(token);
  const supabaseUrl = process.env.SUPABASE_URL || "";
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!supabaseUrl || !serviceRole) {
    return new Response("Server not configured", { status: 500 });
  }
  if (!normalizedToken) {
    return new Response("Playlist not found", { status: 404 });
  }

  const supabase = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false },
  });

  const { data: tokenRow, error: tokenErr } = await supabase
    .from("playlist_tokens")
    .select("playlist_slug,is_active")
    .eq("token", normalizedToken)
    .single();
  if (tokenErr || !tokenRow || tokenRow.is_active !== true) {
    return new Response("Playlist not found", { status: 404 });
  }
  const slug = tokenRow.playlist_slug;

  const { data: links, error: linksErr } = await supabase
    .from("playlist_channels")
    .select("channel_id,position")
    .eq("playlist_slug", slug)
    .order("position", { ascending: true });
  if (linksErr) {
    return new Response("Failed to fetch playlist links", { status: 500 });
  }
  const ids = (links || []).map((x) => x.channel_id).filter(Boolean);
  if (!ids.length) {
    return new Response(m3uHeader(), { status: 200, headers: { "content-type": "audio/x-mpegurl; charset=utf-8" } });
  }

  const { data: channels, error: channelsErr } = await supabase
    .from("channels")
    .select("id,name,category,logo_url,stream_url,status")
    .in("id", ids)
    .eq("status", "LIVE");
  if (channelsErr) {
    return new Response("Failed to fetch channels", { status: 500 });
  }
  const channelById = Object.fromEntries((channels || []).map((c) => [c.id, c]));

  let out = m3uHeader();
  for (const l of links || []) {
    const c = channelById[l.channel_id];
    if (!c) continue;
    const name = sanitizeAttr(c.name || "Stream");
    const category = sanitizeAttr(c.category || "");
    const logo = sanitizeAttr(c.logo_url || "");
    out += `#EXTINF:-1 tvg-name="${name}" group-title="${category}" tvg-logo="${logo}",${name}\n`;
    out += `${(c.stream_url || "").trim()}\n`;
  }

  return new Response(out, {
    status: 200,
    headers: {
      "content-type": "audio/x-mpegurl; charset=utf-8",
      "cache-control": "public, max-age=60",
    },
  });
}
