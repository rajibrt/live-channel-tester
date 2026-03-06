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

async function fetchAllRows(supabase, table, columns, { orderBy = "id", ascending = true, filters = [] } = {}) {
  const out = [];
  const pageSize = 500;
  let from = 0;
  while (true) {
    let query = supabase
      .from(table)
      .select(columns)
      .order(orderBy, { ascending })
      .range(from, from + pageSize - 1);
    for (const f of filters) {
      if (!f || typeof f !== "object") continue;
      if (f.op === "eq") query = query.eq(f.col, f.val);
      if (f.op === "in") query = query.in(f.col, f.val);
    }
    const { data, error } = await query;
    if (error) throw error;
    const rows = Array.isArray(data) ? data : [];
    out.push(...rows);
    if (!rows.length) break;
    from += rows.length;
  }
  return out;
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

  let channels = [];
  if (ids.length) {
    const { data, error: channelsErr } = await supabase
      .from("channels")
      .select("id,name,category,logo_url,stream_url,status")
      .in("id", ids)
      .eq("status", "LIVE");
    if (channelsErr) {
      return new Response("Failed to fetch channels", { status: 500 });
    }
    channels = Array.isArray(data) ? data : [];
  }
  const channelById = Object.fromEntries(channels.map((c) => [c.id, c]));

  let movies = [];
  let sources = [];
  let mapRows = [];
  let categories = [];
  try {
    movies = await fetchAllRows(supabase, "movies", "id,title,poster_url,is_published,updated_at", {
      orderBy: "updated_at",
      ascending: false,
      filters: [{ op: "eq", col: "is_published", val: true }],
    });
    const movieIds = movies.map((row) => Number(row?.id)).filter((id) => Number.isInteger(id) && id > 0);
    if (movieIds.length) {
      sources = await fetchAllRows(supabase, "movie_sources", "id,movie_id,source_url,is_active,sort_order", {
        orderBy: "id",
        ascending: true,
        filters: [
          { op: "eq", col: "is_active", val: true },
          { op: "in", col: "movie_id", val: movieIds },
        ],
      });
      mapRows = await fetchAllRows(supabase, "movie_category_map", "movie_id,category_id", {
        orderBy: "movie_id",
        ascending: true,
        filters: [{ op: "in", col: "movie_id", val: movieIds }],
      });
      categories = await fetchAllRows(supabase, "movie_categories", "id,name,position", {
        orderBy: "position",
        ascending: true,
      });
    }
  } catch {
    return new Response("Failed to fetch movies", { status: 500 });
  }

  const categoryById = new Map(
    (categories || []).map((row) => [Number(row?.id), String(row?.name || "").trim()]).filter(([, name]) => Boolean(name))
  );
  const sourceByMovie = new Map();
  for (const row of sources || []) {
    const movieId = Number(row?.movie_id);
    if (!movieId) continue;
    const list = sourceByMovie.get(movieId) || [];
    list.push(row);
    sourceByMovie.set(movieId, list);
  }
  for (const [movieId, list] of sourceByMovie.entries()) {
    list.sort((a, b) => {
      const orderDiff = Number(a?.sort_order || 0) - Number(b?.sort_order || 0);
      if (orderDiff !== 0) return orderDiff;
      return Number(a?.id || 0) - Number(b?.id || 0);
    });
    sourceByMovie.set(movieId, list);
  }

  const categoryByMovie = new Map();
  for (const row of mapRows || []) {
    const movieId = Number(row?.movie_id);
    const categoryName = categoryById.get(Number(row?.category_id)) || "";
    if (!movieId || !categoryName) continue;
    const existing = categoryByMovie.get(movieId);
    if (existing) continue;
    categoryByMovie.set(movieId, categoryName);
  }

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

  for (const movie of movies || []) {
    const movieId = Number(movie?.id);
    if (!movieId) continue;
    const sourceList = sourceByMovie.get(movieId) || [];
    const source = sourceList[0];
    const sourceUrl = String(source?.source_url || "").trim();
    if (!sourceUrl) continue;
    const title = sanitizeAttr(movie?.title || `Movie ${movieId}`);
    const logo = sanitizeAttr(movie?.poster_url || "");
    const categoryName = sanitizeAttr(categoryByMovie.get(movieId) || "Movies");
    out += `#EXTINF:0 tvg-name="${title}" tvg-logo="${logo}" group-title="VOD | ${categoryName}" type="movie" tvg-type="movie",${title}\n`;
    out += `${sourceUrl}\n`;
  }

  return new Response(out, {
    status: 200,
    headers: {
      "content-type": "audio/x-mpegurl; charset=utf-8",
      "cache-control": "public, max-age=60",
    },
  });
}
