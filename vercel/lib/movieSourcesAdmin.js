import { normalizeStreamUrl } from "./streamUrl";

// Ordered, de-duplicated link list from an admin payload.
// payload.sources: [{ url | source_url, label, is_active }]
export function readSourcesPayload(payload) {
  if (!Array.isArray(payload?.sources)) return null;
  const seen = new Set();
  const out = [];
  for (const item of payload.sources) {
    const url = normalizeStreamUrl(item?.url ?? item?.source_url ?? "");
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push({
      url,
      label: String(item?.label || "").trim().slice(0, 60) || "default",
      is_active: item?.is_active !== false,
    });
  }
  return out;
}

// Save a movie's links.
// - `sources` array given: the movie's links become exactly that list, in that order.
// - only legacy `source_url` given: it replaces the first link; other links are kept.
// Returns { error } on failure.
export async function saveMovieSources(admin, movieId, payload) {
  const now = new Date().toISOString();
  const list = readSourcesPayload(payload);
  if (list) {
    const { error: delErr } = await admin.from("movie_sources").delete().eq("movie_id", movieId);
    if (delErr) return { error: delErr.message || "Failed to update links" };
    if (!list.length) return {};
    const { error } = await admin.from("movie_sources").insert(
      list.map((s, i) => ({
        movie_id: movieId,
        label: s.label,
        source_url: s.url,
        is_active: s.is_active,
        sort_order: i,
        updated_at: now,
      }))
    );
    return error ? { error: error.message || "Failed to save links" } : {};
  }

  const sourceUrl = normalizeStreamUrl(payload?.source_url);
  if (!sourceUrl) return {};
  const { data: existing } = await admin
    .from("movie_sources")
    .select("id,source_url")
    .eq("movie_id", movieId)
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });
  const rows = Array.isArray(existing) ? existing : [];
  if (rows.some((r) => r.source_url === sourceUrl && r.id === rows[0]?.id)) return {};
  if (rows.length) {
    const { error } = await admin
      .from("movie_sources")
      .update({ source_url: sourceUrl, is_active: true, updated_at: now })
      .eq("id", rows[0].id);
    return error ? { error: error.message || "Failed to save link" } : {};
  }
  const { error } = await admin.from("movie_sources").insert({
    movie_id: movieId,
    label: "default",
    source_url: sourceUrl,
    is_active: true,
    sort_order: 0,
    updated_at: now,
  });
  return error ? { error: error.message || "Failed to save link" } : {};
}

// First link of a payload (used for video-quality detection).
export function firstSourceUrl(payload) {
  const list = readSourcesPayload(payload);
  if (list) return list.find((s) => s.is_active)?.url || list[0]?.url || "";
  return normalizeStreamUrl(payload?.source_url);
}
