import { NextResponse } from "next/server";
import { requireAdminApi } from "../../../../../../lib/adminApi";
import { getSupabaseAdmin } from "../../../../../../lib/supabaseAdmin";

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function POST(request, { params }) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  try {
    const { slug } = await params;
    const playlistSlug = String(slug || "").trim().toLowerCase();
    if (!playlistSlug) {
      return NextResponse.json({ error: "Invalid playlist slug." }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const channels = Array.isArray(body.channels) ? body.channels : [];
    const groupOrder = Array.isArray(body.group_order) ? body.group_order.map((x) => String(x || "").trim()).filter(Boolean) : [];

    const supabase = getSupabaseAdmin();
    const now = new Date().toISOString();
    const keepIds = channels.map((c) => Number(c.id)).filter((x) => Number.isFinite(x));

    const { data: existingLinks, error: existingErr } = await supabase
      .from("playlist_channels")
      .select("channel_id")
      .eq("playlist_slug", playlistSlug);
    if (existingErr) {
      return NextResponse.json({ error: `Failed loading existing links: ${existingErr.message}` }, { status: 500 });
    }
    const existingIds = (existingLinks || []).map((x) => Number(x.channel_id)).filter((x) => Number.isFinite(x));
    const removeIds = existingIds.filter((id) => !keepIds.includes(id));
    if (removeIds.length) {
      const { error: deleteErr } = await supabase
        .from("playlist_channels")
        .delete()
        .eq("playlist_slug", playlistSlug)
        .in("channel_id", removeIds);
      if (deleteErr) {
        return NextResponse.json({ error: `Failed deleting removed channels from playlist: ${deleteErr.message}` }, { status: 500 });
      }
    }

    for (const part of chunk(channels, 100)) {
      const tasks = part.map((c) =>
        supabase
          .from("channels")
          .update({
            name: String(c.name || "Stream").trim() || "Stream",
            category: String(c.category || "").trim(),
            logo_url: String(c.logo_url || "").trim(),
            stream_url: String(c.stream_url || "").trim(),
            updated_at: now,
          })
          .eq("id", Number(c.id))
      );
      const results = await Promise.all(tasks);
      const failed = results.find((r) => r.error);
      if (failed?.error) {
        const msg = String(failed.error.message || "");
        if (msg.toLowerCase().includes("duplicate key value") || msg.toLowerCase().includes("unique")) {
          return NextResponse.json({ error: "Stream URL already exists in another channel. Use a unique stream URL." }, { status: 400 });
        }
        return NextResponse.json({ error: `Failed to update channels: ${failed.error.message}` }, { status: 500 });
      }
    }

    if (channels.length) {
      for (const part of chunk(channels, 500)) {
        const linkRows = part.map((c) => ({
          playlist_slug: playlistSlug,
          channel_id: Number(c.id),
          position: Number(c.position || 0),
        }));
        const { error } = await supabase
          .from("playlist_channels")
          .upsert(linkRows, { onConflict: "playlist_slug,channel_id" });
        if (error) {
          return NextResponse.json({ error: `Failed to update channel order: ${error.message}` }, { status: 500 });
        }
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

    let groupOrderSaved = false;
    if (groupOrder.length) {
      const rows = groupOrder.map((name, idx) => ({
        playlist_slug: playlistSlug,
        name,
        position: idx + 1,
        updated_at: now,
      }));
      const saveGroups = await supabase
        .from("playlist_groups")
        .upsert(rows, { onConflict: "playlist_slug,name" });
      if (!saveGroups.error) {
        groupOrderSaved = true;
      }
    }

    return NextResponse.json({
      ok: true,
      updated_channels: channels.length,
      removed_from_playlist: removeIds.length,
      playlist_slug: playlistSlug,
      group_order_saved: groupOrderSaved,
    });
  } catch (error) {
    return NextResponse.json({ error: error?.message || "Failed to save playlist editor changes." }, { status: 500 });
  }
}
