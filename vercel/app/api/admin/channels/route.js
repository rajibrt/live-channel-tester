import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../../lib/supabaseAdmin";
import { requireAdminApi } from "../../../../lib/adminApi";

export async function POST(request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const form = await request.formData();
  const playlistSlug = String(form.get("playlist_slug") || "").trim().toLowerCase();
  const streamUrl = String(form.get("stream_url") || "").trim();
  const name = String(form.get("name") || "").trim();
  const category = String(form.get("category") || "").trim();
  const logoUrl = String(form.get("logo_url") || "").trim();
  if (!playlistSlug || !streamUrl || !name) {
    return NextResponse.redirect(new URL("/dashboard", request.url), { status: 302 });
  }

  const supabase = getSupabaseAdmin();
  await supabase
    .from("playlists")
    .upsert([{ slug: playlistSlug, name: playlistSlug, updated_at: new Date().toISOString() }], { onConflict: "slug" });

  const { data: channelRows } = await supabase
    .from("channels")
    .upsert(
      [{
        name,
        category,
        logo_url: logoUrl,
        stream_url: streamUrl,
        status: "LIVE",
        updated_at: new Date().toISOString(),
      }],
      { onConflict: "stream_url" }
    )
    .select("id");

  const channelId = channelRows?.[0]?.id;
  if (channelId) {
    await supabase
      .from("playlist_channels")
      .upsert([{ playlist_slug: playlistSlug, channel_id: channelId, position: 0 }], { onConflict: "playlist_slug,channel_id" });
  }

  const { count } = await supabase
    .from("playlist_channels")
    .select("*", { count: "exact", head: true })
    .eq("playlist_slug", playlistSlug);
  await supabase
    .from("playlists")
    .update({ channel_count: count || 0, updated_at: new Date().toISOString() })
    .eq("slug", playlistSlug);

  return NextResponse.redirect(new URL("/dashboard", request.url), { status: 302 });
}
