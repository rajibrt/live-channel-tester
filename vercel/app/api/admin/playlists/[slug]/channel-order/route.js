import { NextResponse } from "next/server";
import { requireAdminApi } from "../../../../../../lib/adminApi";
import { getSupabaseAdmin } from "../../../../../../lib/supabaseAdmin";

// Reorder channels inside one group without touching other groups.
// Body: { channel_ids: [...] } in the new order. The positions those channels
// already occupy are reused, so channels of other groups keep their slots.
export async function POST(request, { params }) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  const { slug } = await params;
  const playlistSlug = String(slug || "").trim().toLowerCase();
  const body = await request.json().catch(() => ({}));
  const order = (Array.isArray(body?.channel_ids) ? body.channel_ids : []).map(Number).filter((n) => Number.isSafeInteger(n) && n > 0);
  if (!playlistSlug || order.length < 2 || new Set(order).size !== order.length) {
    return NextResponse.json({ error: "Provide at least two distinct channel ids." }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { data: rows, error } = await admin
    .from("playlist_channels")
    .select("channel_id,position")
    .eq("playlist_slug", playlistSlug)
    .in("channel_id", order);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if ((rows || []).length !== order.length) {
    return NextResponse.json({ error: "Some channels are not in this playlist." }, { status: 400 });
  }

  let slots = rows.map((r) => Number(r.position || 0)).sort((a, b) => a - b);
  // Duplicate positions (legacy data) would make the order ambiguous: spread them out.
  if (new Set(slots).size !== slots.length) slots = slots.map((p, i) => slots[0] + i);
  const updates = order.map((channelId, index) => ({ playlist_slug: playlistSlug, channel_id: channelId, position: slots[index] }));
  const { error: upsertError } = await admin
    .from("playlist_channels")
    .upsert(updates, { onConflict: "playlist_slug,channel_id" });
  if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 500 });

  return NextResponse.json({ ok: true, positions: updates.map((u) => ({ channel_id: u.channel_id, position: u.position })) });
}
