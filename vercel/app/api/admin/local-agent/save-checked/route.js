import { NextResponse } from "next/server";
import { requireAdminApi } from "../../../../../lib/adminApi";
import { getSupabaseAdmin } from "../../../../../lib/supabaseAdmin";

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function normalizeItem(item) {
  const url = String(item?.url || item?.stream_url || "").trim();
  const name = String(item?.title || item?.name || "Stream").trim() || "Stream";
  const category = String(item?.category || "").trim();
  const logoUrl = String(item?.logo_url || "").trim();
  const status = String(item?.status || "LIVE").trim().toUpperCase() === "DEAD" ? "DEAD" : "LIVE";
  return { url, name, category, logo_url: logoUrl, status };
}

function normalizeName(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function isMissingPlaylistSlug(error) {
  const msg = String(error?.message || "").toLowerCase();
  return msg.includes("playlist_slug") && (msg.includes("null value") || msg.includes("not-null"));
}

function isUnknownColumn(error) {
  const msg = String(error?.message || "").toLowerCase();
  return msg.includes("column") && msg.includes("does not exist");
}

export async function POST(request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json().catch(() => ({}));
    const playlistSlug = String(body.playlist_slug || "").trim().toLowerCase();
    const playlistName = String(body.playlist_name || playlistSlug || "").trim();
    const mergeWithExisting = Boolean(body.merge_with_existing);
    const mergePlaylistSlug = String(body.merge_playlist_slug || "").trim().toLowerCase();
    const rawItems = Array.isArray(body.items) ? body.items : [];
    if (!playlistSlug) {
      return NextResponse.json({ error: "playlist_slug is required." }, { status: 400 });
    }
    if (!rawItems.length) {
      return NextResponse.json({ error: "No items provided to save." }, { status: 400 });
    }

    const uniqueByUrl = new Map();
    for (const raw of rawItems) {
      const item = normalizeItem(raw);
      if (!item.url) continue;
      uniqueByUrl.set(item.url, item);
    }
    const items = [...uniqueByUrl.values()];
    if (!items.length) {
      return NextResponse.json({ error: "No valid stream URLs found in items." }, { status: 400 });
    }

    const targetSlug = mergeWithExisting && mergePlaylistSlug ? mergePlaylistSlug : playlistSlug;
    const targetName = targetSlug === playlistSlug ? (playlistName || playlistSlug) : (playlistName || targetSlug);
    const supabase = getSupabaseAdmin();
    const now = new Date().toISOString();

    await supabase.from("playlists").upsert(
      [{ slug: targetSlug, name: targetName, updated_at: now }],
      { onConflict: "slug" }
    );

    let existingByUrl = new Map();
    const existingNameSet = new Set();
    let basePosition = 0;
    const duplicateUrls = [];
    if (mergeWithExisting) {
      const { data: links, error: linksError } = await supabase
        .from("playlist_channels")
        .select("channel_id,position")
        .eq("playlist_slug", targetSlug);
      if (linksError) {
        return NextResponse.json({ error: `Failed loading existing playlist links: ${linksError.message}` }, { status: 500 });
      }
      const ids = [...new Set((links || []).map((x) => x.channel_id).filter(Boolean))];
      basePosition = (links || []).reduce((max, x) => Math.max(max, Number(x.position || 0)), 0);
      if (ids.length) {
        const { data: existingChannels, error: chErr } = await supabase
          .from("channels")
          .select("id,name,stream_url")
          .in("id", ids);
        if (chErr) {
          return NextResponse.json({ error: `Failed loading existing playlist channels: ${chErr.message}` }, { status: 500 });
        }
        existingByUrl = new Map((existingChannels || []).map((c) => [String(c.stream_url || ""), c]));
        for (const c of existingChannels || []) {
          if (c?.name) existingNameSet.add(normalizeName(c.name));
        }
      }
    }

    const usedNames = new Set(existingNameSet);
    const filtered = [];
    let renamedCount = 0;
    for (const item of items) {
      if (mergeWithExisting && existingByUrl.has(item.url)) {
        duplicateUrls.push(item.url);
        continue;
      }
      const baseName = item.name || "Stream";
      let candidate = baseName;
      let suffix = 1;
      while (usedNames.has(normalizeName(candidate))) {
        candidate = `${baseName} ${suffix}`;
        suffix += 1;
      }
      if (candidate !== baseName) renamedCount += 1;
      usedNames.add(normalizeName(candidate));
      filtered.push({ ...item, name: candidate });
    }
    const saveItems = filtered;
    if (!saveItems.length) {
      return NextResponse.json({
        ok: true,
        playlist_slug: targetSlug,
        saved_channels: 0,
        attached_channels: 0,
        playlist_channel_count: basePosition,
        duplicate_urls_skipped: duplicateUrls.length,
        duplicate_urls: duplicateUrls,
        duplicate_names_renamed: renamedCount,
      });
    }

    let channelRows = [];
    for (const part of chunk(saveItems, 200)) {
      const basePayload = part.map((x) => ({
        name: x.name,
        category: x.category,
        logo_url: x.logo_url,
        stream_url: x.url,
        status: x.status,
        updated_at: now,
      }));

      let rows = null;
      let err = null;

      const withPlaylistSlug = basePayload.map((x) => ({ ...x, playlist_slug: targetSlug }));
      const attemptWithSlug = await supabase
        .from("channels")
        .upsert(withPlaylistSlug, { onConflict: "stream_url" })
        .select("id,stream_url");
      rows = attemptWithSlug.data || null;
      err = attemptWithSlug.error || null;

      if (err && isUnknownColumn(err)) {
        const fallback = await supabase
          .from("channels")
          .upsert(basePayload, { onConflict: "stream_url" })
          .select("id,stream_url");
        rows = fallback.data || null;
        err = fallback.error || null;
      }

      if (err && isMissingPlaylistSlug(err)) {
        return NextResponse.json(
          { error: "Database requires channels.playlist_slug. Please keep Playlist Slug filled and try again." },
          { status: 400 }
        );
      }
      if (err) {
        return NextResponse.json({ error: `Failed saving channels: ${err.message}` }, { status: 500 });
      }
      channelRows = channelRows.concat(rows || []);
    }

    const idByUrl = new Map((channelRows || []).map((r) => [r.stream_url, r.id]));
    if (idByUrl.size < saveItems.length) {
      for (const part of chunk(saveItems.map((x) => x.url), 200)) {
        const { data } = await supabase.from("channels").select("id,stream_url").in("stream_url", part);
        for (const r of data || []) idByUrl.set(r.stream_url, r.id);
      }
    }

    const attaches = [];
    saveItems.forEach((x, idx) => {
      const id = idByUrl.get(x.url);
      if (id) attaches.push({ playlist_slug: targetSlug, channel_id: id, position: basePosition + idx + 1 });
    });

    let attachedCount = 0;
    for (const part of chunk(attaches, 500)) {
      const { error } = await supabase
        .from("playlist_channels")
        .upsert(part, { onConflict: "playlist_slug,channel_id" });
      if (error) {
        return NextResponse.json({ error: `Failed attaching channels: ${error.message}` }, { status: 500 });
      }
      attachedCount += part.length;
    }

    const { count } = await supabase
      .from("playlist_channels")
      .select("*", { count: "exact", head: true })
      .eq("playlist_slug", targetSlug);

    await supabase
      .from("playlists")
      .update({ channel_count: count || 0, updated_at: now })
      .eq("slug", targetSlug);

    return NextResponse.json({
      ok: true,
      playlist_slug: targetSlug,
      saved_channels: saveItems.length,
      attached_channels: attachedCount,
      playlist_channel_count: count || 0,
      duplicate_urls_skipped: duplicateUrls.length,
      duplicate_urls: duplicateUrls,
      duplicate_names_renamed: renamedCount,
    });
  } catch (error) {
    return NextResponse.json({ error: error?.message || "Failed to save checked links." }, { status: 500 });
  }
}
