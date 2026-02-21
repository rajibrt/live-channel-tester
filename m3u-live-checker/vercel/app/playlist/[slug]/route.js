import { createClient } from "@supabase/supabase-js";

function m3uHeader() {
  return "#EXTM3U\n\n";
}

function sanitizeAttr(value) {
  return (value || "").replaceAll('"', "'").trim();
}

export async function GET(_request, context) {
  const { slug } = await context.params;
  const supabaseUrl = process.env.SUPABASE_URL || "";
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!supabaseUrl || !serviceRole) {
    return new Response("Server not configured", { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false },
  });

  const { data: playlist, error: playlistErr } = await supabase
    .from("playlists")
    .select("slug,name,is_public")
    .eq("slug", slug)
    .single();
  if (playlistErr || !playlist || playlist.is_public !== true) {
    return new Response("Playlist not found", { status: 404 });
  }

  const { data: channels, error: channelsErr } = await supabase
    .from("channels")
    .select("name,category,logo_url,stream_url,status")
    .eq("playlist_slug", slug)
    .eq("status", "LIVE")
    .order("category", { ascending: true })
    .order("name", { ascending: true });
  if (channelsErr) {
    return new Response("Failed to fetch channels", { status: 500 });
  }

  let out = m3uHeader();
  for (const c of channels || []) {
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
