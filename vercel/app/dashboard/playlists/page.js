import styles from "../page.module.css";
import { getSupabaseAdmin } from "../../../lib/supabaseAdmin";
import CreatePlaylistForm from "./CreatePlaylistForm";
import PlaylistEditor from "./[slug]/playlist-editor";
import PlaylistsTable from "./PlaylistsTable";

async function getPlaylists() {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("playlists")
    .select("slug,name,channel_count,updated_at")
    .order("updated_at", { ascending: false });
  return Array.isArray(data) ? data : [];
}

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
  let merged = [];
  if (ids.length) {
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
    const channels = channelsRes.data || [];
    const byId = Object.fromEntries((channels || []).map((c) => [c.id, c]));
    merged = (links || [])
      .map((l) => {
        const c = byId[l.channel_id];
        if (!c) return null;
        return { ...c, position: Number(l.position || 0) };
      })
      .filter(Boolean);
  }

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

export default async function PlaylistsPage({ searchParams }) {
  const playlists = await getPlaylists();
  const query = (await searchParams) || {};
  const requestedSlug = String(query?.selected || "").trim().toLowerCase();
  const selectedSlug = requestedSlug || String(playlists[0]?.slug || "").trim().toLowerCase();
  const selectedData = selectedSlug ? await getPlaylistEditorData(selectedSlug) : null;
  const base = process.env.PUBLIC_PLAYLIST_BASE_URL || "";
  const playlistUrl =
    selectedData?.activeToken && base
      ? `${base}/playlist/${selectedData.activeToken}.m3u`
      : "";

  return (
    <section className={styles.form}>
      <div className={styles.grid}>
        <article className={styles.card}>
          <h2>Create / Update Playlist</h2>
          <CreatePlaylistForm />
        </article>

        <article className={styles.card}>
          <h2>Generate Permanent Token</h2>
          <form method="post" action="/api/admin/tokens" className={styles.form}>
            <label className={styles.field}>
              <span>Playlist Slug</span>
              <input name="playlist_slug" placeholder="playlist slug" list="playlist-slug-list" required />
              <datalist id="playlist-slug-list">
                {playlists.map((p) => (
                  <option key={p.slug} value={String(p.slug || "")} />
                ))}
              </datalist>
            </label>
            <button type="submit" className={styles.primaryBtn}>Generate / Rotate Token</button>
          </form>
        </article>
      </div>

      <article className={styles.card}>
        <h2>Existing Playlists</h2>
        <PlaylistsTable items={playlists} selectedSlug={selectedSlug} />
      </article>

      {selectedData ? (
        <article id="playlist-editor" className={styles.card}>
          <h2>{selectedData.playlist.name}</h2>
          <p className={styles.hint}>Slug: {selectedData.playlist.slug}</p>
          <PlaylistEditor
            playlistSlug={selectedData.playlist.slug}
            playlistName={selectedData.playlist.name}
            playlistUrl={playlistUrl}
            initialChannels={selectedData.channels}
            initialGroups={selectedData.savedGroups || []}
          />
        </article>
      ) : selectedSlug ? (
        <article id="playlist-editor" className={styles.card}>
          <h2>Playlist not found</h2>
          <p className={styles.hint}>Selected slug: {selectedSlug}</p>
        </article>
      ) : null}
    </section>
  );
}
