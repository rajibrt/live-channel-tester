import { NextResponse } from "next/server";
import { requireClientOrPublicReadApi } from "../../../../../lib/clientApi";
import { getSupabaseAdmin } from "../../../../../lib/supabaseAdmin";

export const dynamic = "force-dynamic";

// Body: { sourceId, ok } — one playback result for a radio link (drives admin stats).
export async function POST(request) {
  const auth = await requireClientOrPublicReadApi();
  if (!auth.ok) return auth.response;
  const body = await request.json().catch(() => ({}));
  const sourceId = Number(body?.sourceId);
  if (!Number.isSafeInteger(sourceId) || sourceId <= 0) return NextResponse.json({ error: "Invalid source." }, { status: 400 });
  const { error } = await getSupabaseAdmin().rpc("record_radio_source_result", { p_source_id: sourceId, p_ok: body?.ok === true });
  if (error) return NextResponse.json({ ok: false }, { status: 200 });
  return NextResponse.json({ ok: true });
}
