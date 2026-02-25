import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { requireAdminApi } from "../../../../../lib/adminApi";

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function isMissingColumn(error) {
  const msg = String(error?.message || "").toLowerCase();
  return msg.includes("column") && msg.includes("does not exist");
}

function isMissingTable(error, tableName) {
  const msg = String(error?.message || "").toLowerCase();
  const table = String(tableName || "").toLowerCase();
  return (
    (msg.includes("could not find the table") && msg.includes(table)) ||
    (msg.includes("relation") && msg.includes(table) && msg.includes("does not exist"))
  );
}

export async function POST(request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const oldSlug = String(body?.old_slug || "").trim().toLowerCase();
  const newName = String(body?.new_name || "").trim();
  const newSlug = slugify(newName);

  if (!oldSlug || !newName || !newSlug) {
    return NextResponse.json({ error: "old_slug and new_name are required." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  const { data: oldPlaylist, error: oldErr } = await supabase
    .from("playlists")
    .select("slug,name,channel_count")
    .eq("slug", oldSlug)
    .maybeSingle();
  if (oldErr) return NextResponse.json({ error: oldErr.message }, { status: 500 });
  if (!oldPlaylist) return NextResponse.json({ error: "Playlist not found." }, { status: 404 });

  if (newSlug === oldSlug) {
    const { error } = await supabase
      .from("playlists")
      .update({ name: newName, updated_at: now })
      .eq("slug", oldSlug);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({
      ok: true,
      item: { slug: oldSlug, name: newName, channel_count: Number(oldPlaylist.channel_count || 0), updated_at: now },
    });
  }

  const { data: existingTarget, error: existingErr } = await supabase
    .from("playlists")
    .select("slug")
    .eq("slug", newSlug)
    .maybeSingle();
  if (existingErr) return NextResponse.json({ error: existingErr.message }, { status: 500 });
  if (existingTarget) {
    return NextResponse.json({ error: "A playlist with this generated slug already exists." }, { status: 409 });
  }

  const { error: createErr } = await supabase
    .from("playlists")
    .insert([
      {
        slug: newSlug,
        name: newName,
        channel_count: Number(oldPlaylist.channel_count || 0),
        updated_at: now,
      },
    ]);
  if (createErr) return NextResponse.json({ error: createErr.message }, { status: 500 });

  const { error: linksErr } = await supabase
    .from("playlist_channels")
    .update({ playlist_slug: newSlug })
    .eq("playlist_slug", oldSlug);
  if (linksErr) return NextResponse.json({ error: linksErr.message }, { status: 500 });

  const { error: groupsErr } = await supabase
    .from("playlist_groups")
    .update({ playlist_slug: newSlug, updated_at: now })
    .eq("playlist_slug", oldSlug);
  if (groupsErr && !isMissingTable(groupsErr, "playlist_groups")) {
    return NextResponse.json({ error: groupsErr.message }, { status: 500 });
  }

  const { error: tokenErr } = await supabase
    .from("playlist_tokens")
    .update({ playlist_slug: newSlug })
    .eq("playlist_slug", oldSlug);
  if (tokenErr) return NextResponse.json({ error: tokenErr.message }, { status: 500 });

  // Some databases include channels.playlist_slug, others do not.
  const channelsUpdate = await supabase
    .from("channels")
    .update({ playlist_slug: newSlug, updated_at: now })
    .eq("playlist_slug", oldSlug);
  if (channelsUpdate.error && !isMissingColumn(channelsUpdate.error)) {
    return NextResponse.json({ error: channelsUpdate.error.message }, { status: 500 });
  }

  const { error: deleteErr } = await supabase.from("playlists").delete().eq("slug", oldSlug);
  if (deleteErr) return NextResponse.json({ error: deleteErr.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    item: { slug: newSlug, name: newName, channel_count: Number(oldPlaylist.channel_count || 0), updated_at: now },
  });
}
