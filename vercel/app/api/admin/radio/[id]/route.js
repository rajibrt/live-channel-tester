import { NextResponse } from "next/server";
import { requireAdminApi } from "../../../../../lib/adminApi";
import { getSupabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { cleanStationInput, refreshRadioCache } from "../../../../../lib/radioAdmin";

export const dynamic = "force-dynamic";

function parseId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export async function PATCH(request, { params }) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ error: "Invalid station id." }, { status: 400 });
  const body = await request.json().catch(() => ({}));
  const admin = getSupabaseAdmin();
  // band is needed to validate frequency
  if (body.frequency !== undefined && body.band === undefined) {
    const { data: cur } = await admin.from("radio_stations").select("band").eq("id", id).maybeSingle();
    body.band = cur?.band || "FM";
  }
  const cleaned = cleanStationInput(body, { partial: true });
  if (cleaned.error) return NextResponse.json({ error: cleaned.error }, { status: 400 });
  const { data, error } = await admin
    .from("radio_stations")
    .update({ ...cleaned.value, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Station not found." }, { status: 404 });
  refreshRadioCache();
  return NextResponse.json({ station: data });
}

export async function DELETE(_request, { params }) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ error: "Invalid station id." }, { status: 400 });
  const { data, error } = await getSupabaseAdmin().from("radio_stations").delete().eq("id", id).select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data?.length) return NextResponse.json({ error: "Station not found." }, { status: 404 });
  refreshRadioCache();
  return NextResponse.json({ ok: true });
}
