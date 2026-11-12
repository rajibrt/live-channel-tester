import { NextResponse } from "next/server";
import { requireClientApi } from "../../../../../lib/clientApi";
import { getSupabaseAdmin } from "../../../../../lib/supabaseAdmin";

export const dynamic = "force-dynamic";

// Signed-in viewers' favourite radio stations. Guests keep favourites on the device only.
export async function GET() {
  const auth = await requireClientApi();
  if (!auth.ok) return auth.response;
  const { data, error } = await getSupabaseAdmin()
    .from("client_radio_favorites")
    .select("station_id")
    .eq("user_id", auth.current.user.id)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ ids: [] });
  return NextResponse.json({ ids: (data || []).map((r) => String(r.station_id)) });
}

// Body: { stationId, favorite: true | false }
export async function POST(request) {
  const auth = await requireClientApi();
  if (!auth.ok) return auth.response;
  const body = await request.json().catch(() => ({}));
  const stationId = Number(body?.stationId);
  if (!Number.isSafeInteger(stationId) || stationId <= 0) return NextResponse.json({ error: "Invalid station." }, { status: 400 });
  const admin = getSupabaseAdmin();
  const userId = auth.current.user.id;
  const { error } = body?.favorite
    ? await admin.from("client_radio_favorites").upsert({ user_id: userId, station_id: stationId }, { onConflict: "user_id,station_id" })
    : await admin.from("client_radio_favorites").delete().eq("user_id", userId).eq("station_id", stationId);
  if (error) return NextResponse.json({ error: "Could not save the favourite. Please try again." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
