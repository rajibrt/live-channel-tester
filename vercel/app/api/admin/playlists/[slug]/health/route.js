import { NextResponse } from "next/server";
import { requireAdminApi } from "../../../../../../lib/adminApi";
import { getSupabaseAdmin } from "../../../../../../lib/supabaseAdmin";

// Viewer-reported playback results per channel in this playlist,
// summed over its links (channel_sources.success_count / failure_count).
export async function GET(_request, { params }) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  const { slug } = await params;
  const playlistSlug = String(slug || "").trim().toLowerCase();
  const admin = getSupabaseAdmin();

  const ids = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin
      .from("playlist_channels")
      .select("channel_id")
      .eq("playlist_slug", playlistSlug)
      .order("channel_id")
      .range(from, from + 999);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    ids.push(...(data || []).map((r) => Number(r.channel_id)));
    if (!data || data.length < 1000) break;
  }

  const stats = {};
  let available = true;
  for (let i = 0; i < ids.length && available; i += 200) {
    for (let from = 0; ; from += 1000) {
      const { data, error } = await admin
        .from("channel_sources")
        .select("channel_id,is_active,success_count,failure_count,last_success_at,last_failure_at")
        .in("channel_id", ids.slice(i, i + 200))
        .order("id")
        .range(from, from + 999);
      if (error) {
        available = false;
        break;
      }
      for (const row of data || []) {
        const key = String(row.channel_id);
        const s = stats[key] || { links: 0, active: 0, ok: 0, fail: 0, lastSuccessAt: null, lastFailureAt: null };
        s.links += 1;
        if (row.is_active) s.active += 1;
        s.ok += Number(row.success_count || 0);
        s.fail += Number(row.failure_count || 0);
        if (row.last_success_at && (!s.lastSuccessAt || row.last_success_at > s.lastSuccessAt)) s.lastSuccessAt = row.last_success_at;
        if (row.last_failure_at && (!s.lastFailureAt || row.last_failure_at > s.lastFailureAt)) s.lastFailureAt = row.last_failure_at;
        stats[key] = s;
      }
      if (!data || data.length < 1000) break;
    }
  }

  return NextResponse.json({ available, stats, generated_at: new Date().toISOString() });
}
