import styles from "../../../page.module.css";
import { getSupabaseAdmin } from "../../../../../lib/supabaseAdmin";
import LiveCheckWorkspace from "./live-check-workspace";

const PAGE_SIZE = 1000;

async function fetchAllPlaylistLinks(supabase, slug) {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("playlist_channels")
      .select("channel_id,position")
      .eq("playlist_slug", slug)
      .order("position", { ascending: true })
      .range(from, to);
    if (error) throw error;
    const batch = Array.isArray(data) ? data : [];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return rows;
}

async function fetchChannelsByIds(supabase, ids) {
  const uniqueIds = [...new Set((ids || []).filter(Boolean))];
  const rows = [];
  const selectWithHome = "id,name,category,logo_url,stream_url,status,include_on_home";
  const selectWithoutHome = "id,name,category,logo_url,stream_url,status";

  for (let i = 0; i < uniqueIds.length; i += PAGE_SIZE) {
    const part = uniqueIds.slice(i, i + PAGE_SIZE);
    let res = await supabase.from("channels").select(selectWithHome).in("id", part);
    if (res.error && String(res.error.message || "").toLowerCase().includes("include_on_home")) {
      res = await supabase.from("channels").select(selectWithoutHome).in("id", part);
    }
    if (res.error) throw res.error;
    rows.push(...(res.data || []));
  }
  return rows;
}

async function getPlaylistData(slug) {
  const supabase = getSupabaseAdmin();
  const { data: playlist } = await supabase
    .from("playlists")
    .select("slug,name,channel_count")
    .eq("slug", slug)
    .single();
  if (!playlist) return null;

  const links = await fetchAllPlaylistLinks(supabase, slug);
  const ids = (links || []).map((x) => x.channel_id).filter(Boolean);
  const channels = ids.length ? await fetchChannelsByIds(supabase, ids) : [];
  const byId = Object.fromEntries((channels || []).map((c) => [c.id, c]));
  const merged = (links || [])
    .map((l) => {
      const c = byId[l.channel_id];
      if (!c) return null;
      return { ...c, position: Number(l.position || 0) };
    })
    .filter(Boolean);

  let savedGroups = [];
  const groupRes = await supabase
    .from("playlist_groups")
    .select("name,position")
    .eq("playlist_slug", slug)
    .order("position", { ascending: true });
  if (!groupRes.error) {
    savedGroups = (groupRes.data || []).map((g) => String(g.name || "").trim()).filter(Boolean);
  }

  return { playlist, channels: merged, savedGroups };
}

export default async function PlaylistLiveCheckPage({ params }) {
  const { slug } = await params;
  const data = await getPlaylistData(slug);

  if (!data) {
    return (
      <section className={styles.card}>
        <h2>Playlist not found</h2>
      </section>
    );
  }

  return (
    <LiveCheckWorkspace
      playlistSlug={data.playlist.slug}
      playlistName={data.playlist.name}
      initialChannels={data.channels}
      initialGroups={data.savedGroups || []}
    />
  );
}
