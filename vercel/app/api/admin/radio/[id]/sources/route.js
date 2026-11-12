import { NextResponse } from "next/server";
import { requireAdminApi } from "../../../../../../lib/adminApi";
import { getSupabaseAdmin } from "../../../../../../lib/supabaseAdmin";
import { cleanSourceList, refreshRadioCache, replaceStationSources } from "../../../../../../lib/radioAdmin";

export const dynamic = "force-dynamic";

function parseId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

async function loadSources(admin, id) {
  const { data, error } = await admin
    .from("radio_station_sources")
    .select("id,stream_url,label,priority,is_active,success_count,failure_count,last_success_at,last_failure_at")
    .eq("station_id", id)
    .order("priority", { ascending: true })
    .order("id", { ascending: true });
  if (error) throw new Error(error.message);
  return data || [];
}

export async function GET(_request, { params }) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ error: "Invalid station id." }, { status: 400 });
  try {
    return NextResponse.json({ sources: await loadSources(getSupabaseAdmin(), id) });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// Body: { sources: [{ stream_url, label, is_active }] } in the desired order.
export async function PUT(request, { params }) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ error: "Invalid station id." }, { status: 400 });
  const body = await request.json().catch(() => ({}));
  const cleaned = cleanSourceList(body.sources);
  if (cleaned.error) return NextResponse.json({ error: cleaned.error }, { status: 400 });
  const admin = getSupabaseAdmin();
  const { data: station } = await admin.from("radio_stations").select("id").eq("id", id).maybeSingle();
  if (!station) return NextResponse.json({ error: "Station not found." }, { status: 404 });
  try {
    await replaceStationSources(admin, id, cleaned.value);
    refreshRadioCache();
    return NextResponse.json({ sources: await loadSources(admin, id) });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
