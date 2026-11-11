import { NextResponse } from "next/server";
import { requireAdminApi } from "../../../../../lib/adminApi";
import { getSupabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { ensurePlaylistGroup } from "../../../../../lib/playlistGroups";

// Update one channel's details from the playlist workspace drawer.
// Body: { name?, category?, logo_url?, include_on_home?, playlist_slug? }
// Links are managed separately in ./sources.
export async function PATCH(request, { params }) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const channelId = Number(id);
  if (!Number.isSafeInteger(channelId) || channelId <= 0) {
    return NextResponse.json({ error: "Invalid channel id." }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const patch = { updated_at: new Date().toISOString() };
  if (body.name !== undefined) {
    const name = String(body.name || "").trim();
    if (!name) return NextResponse.json({ error: "Channel name is required." }, { status: 400 });
    patch.name = name.slice(0, 200);
  }
  if (body.category !== undefined) patch.category = String(body.category || "").trim().slice(0, 120);
  if (body.logo_url !== undefined) {
    const logo = String(body.logo_url || "").trim();
    if (logo && !/^https?:\/\//i.test(logo) && !logo.startsWith("/api/media/")) {
      return NextResponse.json({ error: "Logo URL must start with http:// or https://." }, { status: 400 });
    }
    patch.logo_url = logo.slice(0, 2000);
  }
  if (body.include_on_home !== undefined) patch.include_on_home = Boolean(body.include_on_home);

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("channels")
    .update(patch)
    .eq("id", channelId)
    .select("id,name,category,logo_url,stream_url,status,include_on_home")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Channel not found." }, { status: 404 });

  const playlistSlug = String(body.playlist_slug || "").trim().toLowerCase();
  if (playlistSlug && patch.category) await ensurePlaylistGroup(admin, playlistSlug, patch.category);

  return NextResponse.json({ ok: true, channel: data });
}
