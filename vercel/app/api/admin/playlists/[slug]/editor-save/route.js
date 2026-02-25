import { NextResponse } from "next/server";
import { requireAdminApi } from "../../../../../../lib/adminApi";
import { getSupabaseAdmin } from "../../../../../../lib/supabaseAdmin";
import { normalizeStreamUrl } from "../../../../../../lib/streamUrl";

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function uniqueStrings(values) {
  return [...new Set((Array.isArray(values) ? values : []).map((x) => String(x || "").trim()).filter(Boolean))];
}

function isMissingIncludeOnHomeColumn(error) {
  const msg = String(error?.message || "").toLowerCase();
  return msg.includes("include_on_home") && (msg.includes("column") || msg.includes("schema cache"));
}

function isMissingPlaylistGroupsTable(error) {
  const msg = String(error?.message || "").toLowerCase();
  return msg.includes("playlist_groups") && (msg.includes("table") || msg.includes("schema cache"));
}

function toChannelUpdatePayload(channel, now, includeOnHome) {
  const payload = {
    name: String(channel.name || "Stream").trim() || "Stream",
    category: String(channel.category || "").trim(),
    logo_url: String(channel.logo_url || "").trim(),
    stream_url: normalizeStreamUrl(channel.stream_url),
    updated_at: now,
  };
  if (includeOnHome) payload.include_on_home = channel.include_on_home !== false;
  return payload;
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
    const groupOrder = uniqueStrings(body.group_order);

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

    let includeOnHomeSupported = true;
    for (const part of chunk(channels, 100)) {
      const runPartUpdate = async (withIncludeOnHome) => {
        const tasks = part.map((c) =>
          supabase
            .from("channels")
            .update(toChannelUpdatePayload(c, now, withIncludeOnHome))
            .eq("id", Number(c.id))
        );
        return Promise.all(tasks);
      };

      let results = await runPartUpdate(includeOnHomeSupported);
      let failed = results.find((r) => r.error);

      if (failed?.error && includeOnHomeSupported && isMissingIncludeOnHomeColumn(failed.error)) {
        includeOnHomeSupported = false;
        results = await runPartUpdate(false);
        failed = results.find((r) => r.error);
      }

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
    let groupOrderSkipped = false;
    const existingGroupsRes = await supabase
      .from("playlist_groups")
      .select("name")
      .eq("playlist_slug", playlistSlug);
    if (existingGroupsRes.error && !isMissingPlaylistGroupsTable(existingGroupsRes.error)) {
      return NextResponse.json({ error: `Failed loading existing groups: ${existingGroupsRes.error.message}` }, { status: 500 });
    }
    if (existingGroupsRes.error && isMissingPlaylistGroupsTable(existingGroupsRes.error)) {
      groupOrderSkipped = true;
    } else {
      const existingGroupNames = uniqueStrings((existingGroupsRes.data || []).map((x) => x.name));
      const keepGroupSet = new Set(groupOrder);
      const deleteGroups = existingGroupNames.filter((name) => !keepGroupSet.has(name));
      if (deleteGroups.length) {
        const delGroupsRes = await supabase
          .from("playlist_groups")
          .delete()
          .eq("playlist_slug", playlistSlug)
          .in("name", deleteGroups);
        if (delGroupsRes.error) {
          return NextResponse.json({ error: `Failed deleting removed groups: ${delGroupsRes.error.message}` }, { status: 500 });
        }
      }
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
        if (saveGroups.error) {
          return NextResponse.json({ error: `Failed saving group order: ${saveGroups.error.message}` }, { status: 500 });
        }
      }
      groupOrderSaved = true;
    }

    return NextResponse.json({
      ok: true,
      updated_channels: channels.length,
      removed_from_playlist: removeIds.length,
      playlist_slug: playlistSlug,
      group_order_saved: groupOrderSaved,
      group_order_skipped: groupOrderSkipped,
    });
  } catch (error) {
    return NextResponse.json({ error: error?.message || "Failed to save playlist editor changes." }, { status: 500 });
  }
}
