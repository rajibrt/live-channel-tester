import { NextResponse } from "next/server";
import { requireAdminApi } from "../../../../../../lib/adminApi";
import { getSupabaseAdmin } from "../../../../../../lib/supabaseAdmin";
import { ensurePlaylistGroup, touchPlaylist } from "../../../../../../lib/playlistGroups";

// Bulk channel actions from the playlist workspace.
// Body: { ids: [...], action: "show_home" | "hide_home" | "move_group", category? }
// Remove / LIVE / DEAD use the existing ./health-actions route.
export async function POST(request, { params }) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  const { slug } = await params;
  const playlistSlug = String(slug || "").trim().toLowerCase();
  const body = await request.json().catch(() => ({}));
  const ids = [...new Set((Array.isArray(body?.ids) ? body.ids : []).map(Number).filter((n) => Number.isSafeInteger(n) && n > 0))];
  const action = String(body?.action || "");
  if (!playlistSlug || !ids.length) return NextResponse.json({ error: "Select at least one channel." }, { status: 400 });

  const admin = getSupabaseAdmin();
  // Only touch channels that belong to this playlist.
  const { data: linked, error: linkError } = await admin
    .from("playlist_channels")
    .select("channel_id")
    .eq("playlist_slug", playlistSlug)
    .in("channel_id", ids);
  if (linkError) return NextResponse.json({ error: linkError.message }, { status: 500 });
  const allowed = (linked || []).map((r) => Number(r.channel_id));
  if (!allowed.length) return NextResponse.json({ error: "No matching channels in this playlist." }, { status: 404 });

  const now = new Date().toISOString();
  let patch;
  if (action === "show_home" || action === "hide_home") {
    patch = { include_on_home: action === "show_home", updated_at: now };
  } else if (action === "move_group") {
    const category = String(body?.category || "").trim().slice(0, 120);
    if (!category) return NextResponse.json({ error: "Choose a group." }, { status: 400 });
    patch = { category, updated_at: now };
    await ensurePlaylistGroup(admin, playlistSlug, category);
  } else {
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }

  for (let i = 0; i < allowed.length; i += 200) {
    const { error } = await admin.from("channels").update(patch).in("id", allowed.slice(i, i + 200));
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  await touchPlaylist(admin, playlistSlug);
  return NextResponse.json({ ok: true, updated: allowed.length, patch });
}
