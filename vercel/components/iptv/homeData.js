import { getSupabaseAdmin } from "../../lib/supabaseAdmin";

function norm(value) {
  return String(value || "").trim();
}

function normKey(value) {
  return norm(value).toLowerCase();
}

function normalizeCategory(value) {
  const raw = norm(value);
  return raw || "Uncategorized";
}

function normalizeUrl(value) {
  return norm(value);
}

function hashGradient(seed) {
  return seed ? "linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)" : "var(--primary)";
}

function pickIcon(categoryName) {
  const v = normKey(categoryName);
  if (v.includes("news")) return "Newspaper";
  if (v.includes("sport")) return "Trophy";
  if (v.includes("movie") || v.includes("film")) return "Film";
  if (v.includes("entertain")) return "Sparkles";
  if (v.includes("kid")) return "Baby";
  if (v.includes("music")) return "Music";
  if (v.includes("doc")) return "BookOpen";
  if (v.includes("relig")) return "Church";
  if (v.includes("bangla")) return "Globe";
  if (v.includes("inter") || v.includes("world")) return "Earth";
  if (v.includes("hd")) return "MonitorPlay";
  if (v.includes("live")) return "Radio";
  return "Globe";
}

export async function getHomeIptvData() {
  const supabase = getSupabaseAdmin();

  const { data: links, error: linksErr } = await supabase
    .from("playlist_channels")
    .select("playlist_slug,channel_id,position")
    .order("playlist_slug", { ascending: true })
    .order("position", { ascending: true });

  if (linksErr || !Array.isArray(links) || !links.length) {
    return {
      channels: [],
      categories: [],
      debug: {
        links_total: 0,
        live_rows_total: 0,
        deduped_channels_total: 0,
        categories_total: 0,
        generated_at: new Date().toISOString(),
      },
    };
  }

  const ids = [...new Set(links.map((x) => Number(x.channel_id)).filter((x) => Number.isFinite(x)))];
  if (!ids.length) {
    return {
      channels: [],
      categories: [],
      debug: {
        links_total: links.length,
        live_rows_total: 0,
        deduped_channels_total: 0,
        categories_total: 0,
        generated_at: new Date().toISOString(),
      },
    };
  }

  let rows = [];
  let rowsErr = null;
  ({ data: rows, error: rowsErr } = await supabase
    .from("channels")
    .select("id,name,category,logo_url,stream_url,status,include_on_home")
    .in("id", ids)
    .eq("status", "LIVE")
    .eq("include_on_home", true));

  if (rowsErr && String(rowsErr.message || "").toLowerCase().includes("include_on_home")) {
    ({ data: rows, error: rowsErr } = await supabase
      .from("channels")
      .select("id,name,category,logo_url,stream_url,status")
      .in("id", ids)
      .eq("status", "LIVE"));
  }

  if (rowsErr || !Array.isArray(rows) || !rows.length) {
    return {
      channels: [],
      categories: [],
      debug: {
        links_total: links.length,
        live_rows_total: 0,
        deduped_channels_total: 0,
        categories_total: 0,
        generated_at: new Date().toISOString(),
      },
    };
  }

  const byId = new Map(rows.map((row) => [Number(row.id), row]));
  const seenUrl = new Set();
  const channels = [];

  for (const link of links) {
    const row = byId.get(Number(link.channel_id));
    if (!row) continue;

    const streamUrl = normalizeUrl(row.stream_url);
    if (!streamUrl) continue;

    const urlKey = streamUrl.toLowerCase();
    if (seenUrl.has(urlKey)) continue;
    seenUrl.add(urlKey);

    const category = normalizeCategory(row.category);
    const name = norm(row.name) || "Stream";
    const logoText = name.slice(0, 1).toUpperCase() || "TV";

    channels.push({
      id: String(row.id),
      name,
      category,
      logo: logoText,
      logoUrl: norm(row.logo_url),
      streamUrl,
      isLive: true,
      gradientStyle: hashGradient(`${name}:${streamUrl}`),
      playlistSlug: norm(link.playlist_slug),
      position: Number(link.position || 0),
    });
  }

  const categoryMap = new Map();
  for (const channel of channels) {
    const key = normKey(channel.category);
    if (!key) continue;
    if (!categoryMap.has(key)) {
      categoryMap.set(key, {
        id: key.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "uncategorized",
        name: channel.category,
        icon: pickIcon(channel.category),
      });
    }
  }

  const categories = Array.from(categoryMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  return {
    channels,
    categories,
    debug: {
      links_total: links.length,
      live_rows_total: rows.length,
      deduped_channels_total: channels.length,
      categories_total: categories.length,
      generated_at: new Date().toISOString(),
    },
  };
}
