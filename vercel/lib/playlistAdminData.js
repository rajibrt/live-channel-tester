import { getSupabaseAdmin } from "./supabaseAdmin";

// Server-side loaders for the admin playlist pages.

const PAGE_SIZE = 1000;

async function fetchAllPages(build) {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await build().range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const batch = Array.isArray(data) ? data : [];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return rows;
}

async function fetchChannelsByIds(supabase, ids) {
  const uniqueIds = [...new Set((ids || []).filter(Boolean))];
  const rows = [];
  const withHome = "id,name,category,logo_url,stream_url,status,include_on_home";
  const withoutHome = "id,name,category,logo_url,stream_url,status";
  for (let i = 0; i < uniqueIds.length; i += 200) {
    const part = uniqueIds.slice(i, i + 200);
    let res = await supabase.from("channels").select(withHome).in("id", part);
    if (res.error && String(res.error.message || "").toLowerCase().includes("include_on_home")) {
      res = await supabase.from("channels").select(withoutHome).in("id", part);
    }
    if (res.error) throw res.error;
    rows.push(...(res.data || []));
  }
  return rows;
}

async function countSources(supabase, ids) {
  const counts = {};
  for (let i = 0; i < ids.length; i += 200) {
    const part = ids.slice(i, i + 200);
    let rows;
    try {
      rows = await fetchAllPages(() =>
        supabase.from("channel_sources").select("channel_id,is_active").in("channel_id", part).order("id")
      );
    } catch {
      return counts; // table not installed
    }
    for (const row of rows) {
      const key = String(row.channel_id);
      const entry = counts[key] || { total: 0, active: 0 };
      entry.total += 1;
      if (row.is_active) entry.active += 1;
      counts[key] = entry;
    }
  }
  return counts;
}

export function buildPlaylistUrl(token) {
  const base = process.env.PUBLIC_PLAYLIST_BASE_URL || "";
  return token && base ? `${base}/playlist/${token}.m3u` : "";
}

async function loadActiveToken(supabase, slug) {
  const { data } = await supabase
    .from("playlist_tokens")
    .select("token,is_active")
    .eq("playlist_slug", slug)
    .eq("is_active", true)
    .limit(1);
  return Array.isArray(data) && data[0] ? String(data[0].token || "") : "";
}

// Everything the playlist workspace needs for one playlist.
export async function getPlaylistWorkspaceData(slug, { includeSourceCounts = true } = {}) {
  const supabase = getSupabaseAdmin();
  const { data: playlist } = await supabase
    .from("playlists")
    .select("slug,name,channel_count,updated_at")
    .eq("slug", slug)
    .maybeSingle();
  if (!playlist) return null;

  const links = await fetchAllPages(() =>
    supabase
      .from("playlist_channels")
      .select("channel_id,position")
      .eq("playlist_slug", slug)
      .order("position", { ascending: true })
      .order("channel_id", { ascending: true })
  );
  const ids = links.map((l) => Number(l.channel_id)).filter(Boolean);
  const channelRows = ids.length ? await fetchChannelsByIds(supabase, ids) : [];
  const byId = new Map(channelRows.map((c) => [Number(c.id), c]));
  const channels = links
    .map((l) => {
      const c = byId.get(Number(l.channel_id));
      return c ? { ...c, position: Number(l.position || 0) } : null;
    })
    .filter(Boolean);

  let savedGroups = [];
  const groupRes = await supabase
    .from("playlist_groups")
    .select("name,position")
    .eq("playlist_slug", slug)
    .order("position", { ascending: true });
  if (!groupRes.error) {
    savedGroups = (groupRes.data || []).map((g) => String(g.name || "").trim()).filter(Boolean);
  }

  const activeToken = await loadActiveToken(supabase, slug);
  const sourceCounts = includeSourceCounts && ids.length ? await countSources(supabase, ids) : {};

  return { playlist, channels, savedGroups, activeToken, playlistUrl: buildPlaylistUrl(activeToken), sourceCounts };
}

// Playlist cards: totals, LIVE/DEAD and group counts.
export async function getPlaylistSummaries() {
  const supabase = getSupabaseAdmin();
  const { data: playlists } = await supabase
    .from("playlists")
    .select("slug,name,channel_count,updated_at")
    .order("updated_at", { ascending: false });
  const list = Array.isArray(playlists) ? playlists : [];
  const out = [];
  for (const p of list) {
    const links = await fetchAllPages(() =>
      supabase.from("playlist_channels").select("channel_id").eq("playlist_slug", p.slug).order("channel_id")
    ).catch(() => []);
    const ids = links.map((l) => Number(l.channel_id)).filter(Boolean);
    const rows = ids.length ? await fetchChannelsByIds(supabase, ids).catch(() => []) : [];
    const live = rows.filter((r) => String(r.status || "").toUpperCase() !== "DEAD").length;
    const groups = new Set(rows.map((r) => String(r.category || "").trim() || "Uncategorized"));
    const token = await loadActiveToken(supabase, p.slug);
    out.push({
      ...p,
      total: rows.length,
      live,
      dead: rows.length - live,
      groups: groups.size,
      playlistUrl: buildPlaylistUrl(token),
    });
  }
  return out;
}
