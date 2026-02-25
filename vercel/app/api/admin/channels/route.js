import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../../lib/supabaseAdmin";
import { requireAdminApi } from "../../../../lib/adminApi";

function isUnknownColumn(error) {
  const msg = String(error?.message || "").toLowerCase();
  return msg.includes("column") && msg.includes("does not exist");
}

function isMissingPlaylistSlug(error) {
  const msg = String(error?.message || "").toLowerCase();
  return msg.includes("playlist_slug") && (msg.includes("null value") || msg.includes("not-null"));
}

function parseBody(payload) {
  return {
    playlistSlug: String(payload?.playlist_slug || "").trim().toLowerCase(),
    streamUrl: String(payload?.stream_url || "").trim(),
    name: String(payload?.name || "").trim(),
    category: String(payload?.category || "").trim(),
    logoUrl: String(payload?.logo_url || "").trim(),
  };
}

export async function POST(request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const contentType = String(request.headers.get("content-type") || "").toLowerCase();
  let raw = {};
  if (contentType.includes("application/json")) {
    raw = await request.json().catch(() => ({}));
  } else {
    const form = await request.formData();
    raw = {
      playlist_slug: form.get("playlist_slug"),
      stream_url: form.get("stream_url"),
      name: form.get("name"),
      category: form.get("category"),
      logo_url: form.get("logo_url"),
    };
  }
  const { playlistSlug, streamUrl, name, category, logoUrl } = parseBody(raw);

  if (!playlistSlug || !streamUrl || !name) {
    return NextResponse.json({ error: "playlist_slug, name, and stream_url are required." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  await supabase
    .from("playlists")
    .upsert([{ slug: playlistSlug, name: playlistSlug, updated_at: now }], { onConflict: "slug" });

  const basePayload = {
    name,
    category,
    logo_url: logoUrl,
    stream_url: streamUrl,
    status: "LIVE",
    updated_at: now,
  };

  let channelRows = null;
  let channelErr = null;
  const attemptWithSlug = await supabase
    .from("channels")
    .upsert([{ ...basePayload, playlist_slug: playlistSlug }], { onConflict: "stream_url" })
    .select("id,category")
    .maybeSingle();
  channelRows = attemptWithSlug.data || null;
  channelErr = attemptWithSlug.error || null;

  if (channelErr && isUnknownColumn(channelErr)) {
    const fallback = await supabase
      .from("channels")
      .upsert([basePayload], { onConflict: "stream_url" })
      .select("id,category")
      .maybeSingle();
    channelRows = fallback.data || null;
    channelErr = fallback.error || null;
  }

  if (channelErr && isMissingPlaylistSlug(channelErr)) {
    return NextResponse.json(
      { error: "Database requires channels.playlist_slug. Please keep Playlist selected and try again." },
      { status: 400 }
    );
  }

  if (channelErr || !channelRows?.id) {
    return NextResponse.json({ error: channelErr?.message || "Failed to save channel." }, { status: 500 });
  }

  const channelId = channelRows.id;
  if (channelId) {
    const { data: maxPositionRow } = await supabase
      .from("playlist_channels")
      .select("position")
      .eq("playlist_slug", playlistSlug)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextPosition = Number(maxPositionRow?.position || 0) + 1;

    await supabase
      .from("playlist_channels")
      .upsert([{ playlist_slug: playlistSlug, channel_id: channelId, position: nextPosition }], { onConflict: "playlist_slug,channel_id" });
  }

  if (category) {
    const { data: existingGroup } = await supabase
      .from("playlist_groups")
      .select("name")
      .eq("playlist_slug", playlistSlug)
      .eq("name", category)
      .maybeSingle();
    if (!existingGroup) {
      const { data: maxGroupRow } = await supabase
        .from("playlist_groups")
        .select("position")
        .eq("playlist_slug", playlistSlug)
        .order("position", { ascending: false })
        .limit(1)
        .maybeSingle();
      const nextGroupPosition = Number(maxGroupRow?.position || 0) + 1;
      await supabase
        .from("playlist_groups")
        .upsert(
          [{
            playlist_slug: playlistSlug,
            name: category,
            position: nextGroupPosition,
            updated_at: now,
          }],
          { onConflict: "playlist_slug,name" }
        );
    }
  }

  const { count } = await supabase
    .from("playlist_channels")
    .select("*", { count: "exact", head: true })
    .eq("playlist_slug", playlistSlug);
  await supabase
    .from("playlists")
    .update({ channel_count: count || 0, updated_at: now })
    .eq("slug", playlistSlug);

  return NextResponse.json({
    ok: true,
    item: {
      id: channelId,
      name,
      stream_url: streamUrl,
      category: category || String(channelRows.category || ""),
      logo_url: logoUrl,
      playlist_slug: playlistSlug,
    },
  });
}
