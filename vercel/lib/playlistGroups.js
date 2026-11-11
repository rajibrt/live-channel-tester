// Helpers for per-playlist group (category) ordering rows in playlist_groups.

export async function ensurePlaylistGroup(admin, playlistSlug, name) {
  const group = String(name || "").trim();
  if (!playlistSlug || !group) return;
  const { data: existing } = await admin
    .from("playlist_groups")
    .select("name")
    .eq("playlist_slug", playlistSlug)
    .eq("name", group)
    .maybeSingle();
  if (existing) return;
  const { data: last } = await admin
    .from("playlist_groups")
    .select("position")
    .eq("playlist_slug", playlistSlug)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  await admin.from("playlist_groups").upsert(
    [{ playlist_slug: playlistSlug, name: group, position: Number(last?.position || 0) + 1, updated_at: new Date().toISOString() }],
    { onConflict: "playlist_slug,name" }
  );
}

export async function touchPlaylist(admin, playlistSlug) {
  const { count } = await admin
    .from("playlist_channels")
    .select("*", { count: "exact", head: true })
    .eq("playlist_slug", playlistSlug);
  await admin
    .from("playlists")
    .update({ channel_count: count || 0, updated_at: new Date().toISOString() })
    .eq("slug", playlistSlug);
}
