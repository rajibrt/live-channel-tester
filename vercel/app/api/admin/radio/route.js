import { NextResponse } from "next/server";
import { requireAdminApi } from "../../../../lib/adminApi";
import { getSupabaseAdmin } from "../../../../lib/supabaseAdmin";
import { cleanSourceList, cleanStationInput, isMissingRadioTable, MISSING_TABLE_MESSAGE, refreshRadioCache, replaceStationSources } from "../../../../lib/radioAdmin";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  const admin = getSupabaseAdmin();
  const { data: stations, error } = await admin
    .from("radio_stations")
    .select("*")
    .order("position", { ascending: true })
    .order("frequency", { ascending: true, nullsFirst: false })
    .order("id", { ascending: true });
  if (error) {
    const missing = isMissingRadioTable(error);
    return NextResponse.json({ error: missing ? MISSING_TABLE_MESSAGE : error.message, missingTables: missing }, { status: missing ? 503 : 500 });
  }
  const { data: sources, error: srcError } = await admin
    .from("radio_station_sources")
    .select("station_id,is_active,success_count,failure_count");
  if (srcError) return NextResponse.json({ error: srcError.message }, { status: 500 });
  const stats = new Map();
  for (const s of sources || []) {
    const st = stats.get(s.station_id) || { links: 0, active: 0, plays: 0, fails: 0 };
    st.links += 1;
    if (s.is_active) st.active += 1;
    st.plays += s.success_count || 0;
    st.fails += s.failure_count || 0;
    stats.set(s.station_id, st);
  }
  return NextResponse.json({
    stations: (stations || []).map((s) => ({ ...s, stats: stats.get(s.id) || { links: 0, active: 0, plays: 0, fails: 0 } })),
  });
}

// Body: station fields + optional sources: ["url", ...]
export async function POST(request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  const body = await request.json().catch(() => ({}));
  const station = cleanStationInput(body);
  if (station.error) return NextResponse.json({ error: station.error }, { status: 400 });
  const links = cleanSourceList(body.sources || []);
  if (links.error) return NextResponse.json({ error: links.error }, { status: 400 });

  const admin = getSupabaseAdmin();
  const { data: last } = await admin.from("radio_stations").select("position").order("position", { ascending: false }).limit(1);
  const position = (last?.[0]?.position || 0) + 1;
  const { data, error } = await admin.from("radio_stations").insert({ ...station.value, position }).select("*").single();
  if (error) {
    const missing = isMissingRadioTable(error);
    return NextResponse.json({ error: missing ? MISSING_TABLE_MESSAGE : error.message }, { status: missing ? 503 : 500 });
  }
  try {
    if (links.value.length) await replaceStationSources(admin, data.id, links.value);
  } catch (e) {
    return NextResponse.json({ error: e.message, station: data }, { status: 500 });
  }
  refreshRadioCache();
  return NextResponse.json({ station: data });
}
