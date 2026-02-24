import styles from "../../page.module.css";
import { getSupabaseAdmin } from "../../../../lib/supabaseAdmin";
import PlaylistEditor from "./playlist-editor";

async function getPlaylistEditorData(slug) {
  const supabase = getSupabaseAdmin();
  const { data: playlist } = await supabase
    .from("playlists")
    .select("slug,name,channel_count")
    .eq("slug", slug)
    .single();
  if (!playlist) return null;

  const { data: links } = await supabase
    .from("playlist_channels")
    .select("channel_id,position")
    .eq("playlist_slug", slug)
    .order("position", { ascending: true });

  const ids = (links || []).map((x) => x.channel_id).filter(Boolean);
  if (!ids.length) {
    return { playlist, channels: [] };
  }

  let channels = [];
  let channelsRes = await supabase
    .from("channels")
    .select("id,name,category,logo_url,stream_url,status,include_on_home")
    .in("id", ids);
  if (channelsRes.error && String(channelsRes.error.message || "").toLowerCase().includes("include_on_home")) {
    channelsRes = await supabase
      .from("channels")
      .select("id,name,category,logo_url,stream_url,status")
      .in("id", ids);
  }
  channels = channelsRes.data || [];
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

  const { data: tokenRows } = await supabase
    .from("playlist_tokens")
    .select("token,is_active")
    .eq("playlist_slug", slug)
    .eq("is_active", true)
    .limit(1);
  const activeToken = Array.isArray(tokenRows) && tokenRows[0] ? String(tokenRows[0].token || "") : "";

  return { playlist, channels: merged, savedGroups, activeToken };
}

export default async function PlaylistEditorPage({ params }) {
  const { slug } = await params;
  const data = await getPlaylistEditorData(slug);
  const base = process.env.PUBLIC_PLAYLIST_BASE_URL || "";
  const playlistUrl = data?.activeToken && base ? `${base}/playlist/${data.activeToken}.m3u` : "";

  if (!data) {
    return (
      <section className={styles.card}>
        <h2>Playlist not found</h2>
      </section>
    );
  }

  return (
    <>
      <section className={styles.card}>
        <h2>{data.playlist.name}</h2>
        <p className={styles.hint}>Slug: {slug}</p>
      </section>
      <PlaylistEditor
        playlistSlug={data.playlist.slug}
        playlistName={data.playlist.name}
        playlistUrl={playlistUrl}
        initialChannels={data.channels}
        initialGroups={data.savedGroups || []}
      />
    </>
  );
}
