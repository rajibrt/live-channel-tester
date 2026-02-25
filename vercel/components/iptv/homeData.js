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
    .eq("status", "LIVE"));

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
    if (row.include_on_home === false) continue;

    const streamUrl = normalizeUrl(row.stream_url);
    if (!streamUrl) continue;

    const urlKey = streamUrl.toLowerCase();
    if (seenUrl.has(urlKey)) continue;
    seenUrl.add(urlKey);

    const category = normalizeCategory(row.category);
    const name = norm(row.name) || "Stream";
    const logoText = name.slice(0, 1).toUpperCase() || "TV";
    const categoryKey = normKey(category);

    channels.push({
      id: String(row.id),
      name,
      category,
      categoryKey,
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
  const usedCategoryIds = new Set();
  const makeUniqueCategoryId = (value) => {
    const base = value || "uncategorized";
    let next = base;
    let n = 2;
    while (usedCategoryIds.has(next)) {
      next = `${base}-${n}`;
      n += 1;
    }
    usedCategoryIds.add(next);
    return next;
  };
  for (const channel of channels) {
    const key = channel.categoryKey || normKey(channel.category);
    if (!key) continue;
    if (!categoryMap.has(key)) {
      const baseId = key.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "uncategorized";
      categoryMap.set(key, {
        id: makeUniqueCategoryId(baseId),
        name: channel.category,
        icon: pickIcon(channel.category),
      });
    }
  }

  // Attach the exact category id used by sidebar so filtering never drifts on slug collisions.
  for (const channel of channels) {
    const key = channel.categoryKey || normKey(channel.category);
    channel.categoryId = categoryMap.get(key)?.id || "";
  }

  // Keep playlist traversal order so dashboard group sorting is reflected on homepage.
  const categories = Array.from(categoryMap.values());
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
