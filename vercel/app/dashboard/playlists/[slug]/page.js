import styles from "../../page.module.css";
import AdminHeader from "../../AdminHeader";
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

  const { data: channels } = await supabase
    .from("channels")
    .select("id,name,category,logo_url,stream_url,status")
    .in("id", ids);
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

export default async function PlaylistEditorPage({ params }) {
  const { slug } = await params;
  const data = await getPlaylistEditorData(slug);

  return (
    <main className={styles.page}>
      <div className={styles.bgGlow} />
      <section className={styles.shell}>
        <AdminHeader
          title={`Playlist Editor: ${slug}`}
          subtitle="Edit groups, channel info, logo, ordering, then save updates."
        />

        {!data ? (
          <section className={styles.card}>
            <h2>Playlist not found</h2>
          </section>
        ) : (
          <PlaylistEditor
            playlistSlug={data.playlist.slug}
            playlistName={data.playlist.name}
            initialChannels={data.channels}
            initialGroups={data.savedGroups || []}
          />
        )}
      </section>
    </main>
  );
}
