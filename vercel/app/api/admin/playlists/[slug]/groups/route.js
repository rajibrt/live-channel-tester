import { NextResponse } from "next/server";
import { requireAdminApi } from "../../../../../../lib/adminApi";
import { getSupabaseAdmin } from "../../../../../../lib/supabaseAdmin";
import { ensurePlaylistGroup, touchPlaylist } from "../../../../../../lib/playlistGroups";

// Group (category) management for one playlist.
// Body: { action: "reorder", names: [...] }
//       { action: "add", name }
//       { action: "rename", from, to }
//       { action: "delete", name, move_to? }   (move_to required when the group has channels)
// Channels with an empty category are shown as "Uncategorized".

const UNCATEGORIZED = "Uncategorized";

function clean(value) {
  return String(value || "").trim().slice(0, 120);
}

async function channelIdsInGroup(admin, playlistSlug, groupName) {
  const ids = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin
      .from("playlist_channels")
      .select("channel_id")
      .eq("playlist_slug", playlistSlug)
      .order("channel_id")
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    ids.push(...(data || []).map((r) => Number(r.channel_id)));
    if (!data || data.length < 1000) break;
  }
  const matches = [];
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await admin.from("channels").select("id,category").in("id", ids.slice(i, i + 200));
    if (error) throw new Error(error.message);
    for (const row of data || []) {
      const name = String(row.category || "").trim() || UNCATEGORIZED;
      if (name === groupName) matches.push(Number(row.id));
    }
  }
  return matches;
}

async function setCategory(admin, ids, category) {
  const value = category === UNCATEGORIZED ? "" : category;
  for (let i = 0; i < ids.length; i += 200) {
    const { error } = await admin
      .from("channels")
      .update({ category: value, updated_at: new Date().toISOString() })
      .in("id", ids.slice(i, i + 200));
    if (error) throw new Error(error.message);
  }
}

export async function POST(request, { params }) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  const { slug } = await params;
  const playlistSlug = String(slug || "").trim().toLowerCase();
  const body = await request.json().catch(() => ({}));
  const action = String(body?.action || "");
  const admin = getSupabaseAdmin();
  const now = new Date().toISOString();

  try {
    if (action === "reorder") {
      const names = [...new Set((Array.isArray(body?.names) ? body.names : []).map(clean).filter(Boolean))];
      if (!names.length) return NextResponse.json({ error: "No groups given." }, { status: 400 });
      const rows = names.map((name, index) => ({ playlist_slug: playlistSlug, name, position: index + 1, updated_at: now }));
      const { error } = await admin.from("playlist_groups").upsert(rows, { onConflict: "playlist_slug,name" });
      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true, names });
    }

    if (action === "add") {
      const name = clean(body?.name);
      if (!name) return NextResponse.json({ error: "Group name is required." }, { status: 400 });
      await ensurePlaylistGroup(admin, playlistSlug, name);
      return NextResponse.json({ ok: true, name });
    }

    if (action === "rename") {
      const from = clean(body?.from);
      const to = clean(body?.to);
      if (!from || !to) return NextResponse.json({ error: "Old and new names are required." }, { status: 400 });
      if (from === to) return NextResponse.json({ ok: true, moved: 0 });
      const ids = await channelIdsInGroup(admin, playlistSlug, from);
      await setCategory(admin, ids, to);
      const { data: oldRow } = await admin
        .from("playlist_groups")
        .select("position")
        .eq("playlist_slug", playlistSlug)
        .eq("name", from)
        .maybeSingle();
      const { data: targetRow } = await admin
        .from("playlist_groups")
        .select("position")
        .eq("playlist_slug", playlistSlug)
        .eq("name", to)
        .maybeSingle();
      if (!targetRow) {
        await admin
          .from("playlist_groups")
          .upsert([{ playlist_slug: playlistSlug, name: to, position: Number(oldRow?.position || 0) || 9999, updated_at: now }], {
            onConflict: "playlist_slug,name",
          });
      }
      await admin.from("playlist_groups").delete().eq("playlist_slug", playlistSlug).eq("name", from);
      await touchPlaylist(admin, playlistSlug);
      return NextResponse.json({ ok: true, moved: ids.length, merged: Boolean(targetRow) });
    }

    if (action === "delete") {
      const name = clean(body?.name);
      const moveTo = clean(body?.move_to);
      if (!name) return NextResponse.json({ error: "Group name is required." }, { status: 400 });
      const ids = await channelIdsInGroup(admin, playlistSlug, name);
      if (ids.length) {
        if (!moveTo || moveTo === name) {
          return NextResponse.json({ error: `“${name}” has ${ids.length} channel(s). Choose a group to move them to.` }, { status: 400 });
        }
        await setCategory(admin, ids, moveTo);
        await ensurePlaylistGroup(admin, playlistSlug, moveTo);
      }
      await admin.from("playlist_groups").delete().eq("playlist_slug", playlistSlug).eq("name", name);
      await touchPlaylist(admin, playlistSlug);
      return NextResponse.json({ ok: true, moved: ids.length });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Group update failed." }, { status: 500 });
  }
}
