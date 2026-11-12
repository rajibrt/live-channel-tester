import { revalidateTag } from "next/cache";
import { normalizeStreamUrl } from "./streamUrl";

export const RADIO_BANDS = ["FM", "AM", "Online"];
export const RADIO_REGIONS = ["Bangladesh", "India · Bangla", "India · Hindi", "International"];
export const MAX_RADIO_SOURCES = 20;

export function isMissingRadioTable(error) {
  const msg = String(error?.message || "").toLowerCase();
  return error?.code === "PGRST205" || (msg.includes("radio_") && msg.includes("schema cache"));
}

export const MISSING_TABLE_MESSAGE = "Radio tables are missing. Run vercel/supabase/radio_stations.sql in Supabase first.";

export function refreshRadioCache() {
  try {
    revalidateTag("radio-stations", "max");
  } catch {
    // cache refresh is best effort; the list also expires after 60 s
  }
}

// Validates station fields. Returns { value } or { error }.
export function cleanStationInput(body, { partial = false } = {}) {
  const out = {};
  if (!partial || body.name !== undefined) {
    const name = String(body.name || "").trim().slice(0, 80);
    if (!name) return { error: "Name is required." };
    out.name = name;
  }
  if (body.name_bn !== undefined) out.name_bn = String(body.name_bn || "").trim().slice(0, 80);
  if (!partial || body.band !== undefined) {
    const band = RADIO_BANDS.includes(body.band) ? body.band : "FM";
    out.band = band;
  }
  if (body.frequency !== undefined || !partial) {
    const raw = String(body.frequency ?? "").trim();
    if (!raw || out.band === "Online") out.frequency = null;
    else {
      const f = Number(raw);
      const band = out.band || body.band;
      const okFm = band === "FM" && f >= 64 && f <= 110;
      const okAm = band === "AM" && f >= 150 && f <= 30000;
      if (!Number.isFinite(f) || !(okFm || okAm || band === undefined)) {
        return { error: band === "AM" ? "AM frequency must be in kHz (150–30000)." : "FM frequency must be in MHz (64–110)." };
      }
      out.frequency = Math.round(f * 10) / 10;
    }
  }
  if (body.city !== undefined) out.city = String(body.city || "").trim().slice(0, 60);
  if (body.region !== undefined) out.region = RADIO_REGIONS.includes(body.region) ? body.region : "Bangladesh";
  if (body.logo_url !== undefined) {
    const logo = String(body.logo_url || "").trim();
    if (logo && !/^https?:\/\//i.test(logo) && !logo.startsWith("/")) return { error: "Logo must be an http(s) URL." };
    out.logo_url = logo.slice(0, 500);
  }
  if (body.is_active !== undefined) out.is_active = body.is_active !== false;
  if (body.position !== undefined) out.position = Math.max(0, Math.min(100000, Number.parseInt(body.position, 10) || 0));
  return { value: out };
}

export function cleanSourceList(input) {
  const cleaned = [];
  const seen = new Set();
  for (const item of Array.isArray(input) ? input : []) {
    const url = normalizeStreamUrl(typeof item === "string" ? item : item?.stream_url);
    if (!url) continue;
    if (!/^https?:\/\//i.test(url)) return { error: `Only http/https links are allowed: ${url.slice(0, 80)}` };
    const key = url.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    cleaned.push({
      stream_url: url,
      label: String(item?.label || "").trim().slice(0, 60),
      is_active: item?.is_active !== false,
    });
  }
  if (cleaned.length > MAX_RADIO_SOURCES) return { error: `A station can have at most ${MAX_RADIO_SOURCES} links.` };
  return { value: cleaned };
}

// Replace a station's ordered link list, keeping viewer counters for links that stay.
export async function replaceStationSources(admin, stationId, cleaned) {
  const now = new Date().toISOString();
  if (cleaned.length) {
    const rows = cleaned.map((s, index) => ({ station_id: stationId, stream_url: s.stream_url, label: s.label, is_active: s.is_active, priority: index, updated_at: now }));
    const { error } = await admin.from("radio_station_sources").upsert(rows, { onConflict: "station_id,stream_url" });
    if (error) throw new Error(error.message);
  }
  const { data: existing, error: listError } = await admin.from("radio_station_sources").select("id,stream_url").eq("station_id", stationId);
  if (listError) throw new Error(listError.message);
  const keep = new Set(cleaned.map((s) => s.stream_url));
  const remove = (existing || []).filter((r) => !keep.has(r.stream_url)).map((r) => r.id);
  if (remove.length) {
    const { error } = await admin.from("radio_station_sources").delete().in("id", remove);
    if (error) throw new Error(error.message);
  }
}
