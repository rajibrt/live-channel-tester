import { NextResponse } from "next/server";
import { requireAdminApi } from "../../../../../lib/adminApi";
import { getSupabaseAdmin } from "../../../../../lib/supabaseAdmin";

// Body: { ids: [channelId, ...] } -> { counts: { [id]: { total, active } } }
// Used by the playlist editor to show "লিংক (n)" per channel.
export async function POST(request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const ids = [...new Set((Array.isArray(body?.ids) ? body.ids : []).map(Number).filter((n) => Number.isSafeInteger(n) && n > 0))].slice(0, 5000);
  const counts = {};
  if (!ids.length) return NextResponse.json({ counts });

  const admin = getSupabaseAdmin();
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    for (let from = 0; ; from += 1000) {
      const { data, error } = await admin
        .from("channel_sources")
        .select("channel_id,is_active")
        .in("channel_id", chunk)
        .order("id", { ascending: true })
        .range(from, from + 999);
      if (error) return NextResponse.json({ counts, unavailable: true });
      for (const row of data || []) {
        const key = String(row.channel_id);
        const entry = counts[key] || { total: 0, active: 0 };
        entry.total += 1;
        if (row.is_active) entry.active += 1;
        counts[key] = entry;
      }
      if (!data || data.length < 1000) break;
    }
  }
  return NextResponse.json({ counts });
}
