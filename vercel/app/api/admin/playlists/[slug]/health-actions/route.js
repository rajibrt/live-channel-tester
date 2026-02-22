import { NextResponse } from "next/server";
import { requireAdminApi } from "../../../../../../lib/adminApi";
import { getSupabaseAdmin } from "../../../../../../lib/supabaseAdmin";

function uniqueIds(values) {
  return [...new Set((Array.isArray(values) ? values : []).map((x) => Number(x)).filter((x) => Number.isFinite(x)))];
}

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
    const disableIds = uniqueIds(body.disable_ids);
    const enableIds = uniqueIds(body.enable_ids);
    const deleteIds = uniqueIds(body.delete_ids);
    if (!disableIds.length && !enableIds.length && !deleteIds.length) {
      return NextResponse.json({ error: "No action ids provided." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const now = new Date().toISOString();

    let disabledCount = 0;
    for (const part of chunk(disableIds, 300)) {
      const { data, error } = await supabase
        .from("channels")
        .update({ status: "DEAD", updated_at: now })
        .in("id", part)
        .select("id");
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      disabledCount += (data || []).length;
    }

    let enabledCount = 0;
    for (const part of chunk(enableIds, 300)) {
      const { data, error } = await supabase
        .from("channels")
        .update({ status: "LIVE", updated_at: now })
        .in("id", part)
        .select("id");
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      enabledCount += (data || []).length;
    }

    let deletedFromPlaylist = 0;
    let deletedChannelRows = 0;
    if (deleteIds.length) {
      for (const part of chunk(deleteIds, 300)) {
        const { data: removed, error: rmErr } = await supabase
          .from("playlist_channels")
          .delete()
          .eq("playlist_slug", playlistSlug)
          .in("channel_id", part)
          .select("channel_id");
        if (rmErr) return NextResponse.json({ error: rmErr.message }, { status: 500 });
        deletedFromPlaylist += (removed || []).length;
      }

      const { data: remainingRefs, error: refsErr } = await supabase
        .from("playlist_channels")
        .select("channel_id")
        .in("channel_id", deleteIds);
      if (refsErr) return NextResponse.json({ error: refsErr.message }, { status: 500 });
      const stillUsed = new Set((remainingRefs || []).map((x) => Number(x.channel_id)));
      const orphanIds = deleteIds.filter((id) => !stillUsed.has(id));
      if (orphanIds.length) {
        for (const part of chunk(orphanIds, 300)) {
          const { data: deletedRows, error: delErr } = await supabase
            .from("channels")
            .delete()
            .in("id", part)
            .select("id");
          if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });
          deletedChannelRows += (deletedRows || []).length;
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

    return NextResponse.json({
      ok: true,
      disabled_count: disabledCount,
      enabled_count: enabledCount,
      deleted_from_playlist: deletedFromPlaylist,
      deleted_channel_rows: deletedChannelRows,
      playlist_channel_count: count || 0,
    });
  } catch (error) {
    return NextResponse.json({ error: error?.message || "Failed to apply health actions." }, { status: 500 });
  }
}

