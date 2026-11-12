import { unstable_cache } from "next/cache";
import { getSupabaseAdmin } from "./supabaseAdmin";
import { normalizeStreamUrl } from "./streamUrl";

// Public radio line-up: active stations with their ordered active links.
// Missing tables (SQL not applied yet) => empty list.
async function loadRadioStations() {
  const supabase = getSupabaseAdmin();
  const { data: stations, error } = await supabase
    .from("radio_stations")
    .select("id,name,name_bn,band,frequency,city,logo_url,position")
    .eq("is_active", true)
    .order("position", { ascending: true })
    .order("frequency", { ascending: true, nullsFirst: false })
    .order("id", { ascending: true });
  if (error || !stations?.length) return [];

  const ids = stations.map((s) => s.id);
  const { data: rows, error: srcError } = await supabase
    .from("radio_station_sources")
    .select("id,station_id,stream_url,label,priority")
    .eq("is_active", true)
    .in("station_id", ids)
    .order("priority", { ascending: true })
    .order("id", { ascending: true });
  if (srcError) return [];

  const byStation = new Map();
  for (const row of rows || []) {
    const url = normalizeStreamUrl(row.stream_url);
    if (!url) continue;
    const list = byStation.get(row.station_id) || [];
    if (!list.some((s) => s.url.toLowerCase() === url.toLowerCase())) list.push({ id: String(row.id), url, label: String(row.label || "") });
    byStation.set(row.station_id, list);
  }

  return stations
    .map((s) => ({
      id: String(s.id),
      name: String(s.name || "").trim(),
      nameBn: String(s.name_bn || "").trim(),
      band: s.band || "FM",
      frequency: s.frequency === null || s.frequency === undefined ? null : Number(s.frequency),
      city: String(s.city || "").trim(),
      logoUrl: String(s.logo_url || "").trim(),
      sources: byStation.get(s.id) || [],
    }))
    .filter((s) => s.name && s.sources.length);
}

export const getRadioStations = unstable_cache(loadRadioStations, ["radio-stations"], { revalidate: 60, tags: ["radio-stations"] });
