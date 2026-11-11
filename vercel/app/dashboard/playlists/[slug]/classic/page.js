import Link from "next/link";
import styles from "../../../page.module.css";
import { getPlaylistWorkspaceData } from "../../../../../lib/playlistAdminData";
import PlaylistEditor from "../playlist-editor";

export const dynamic = "force-dynamic";

// The previous all-in-one editor, kept while the new workspace is reviewed.
export default async function ClassicPlaylistEditorPage({ params }) {
  const { slug } = await params;
  const data = await getPlaylistWorkspaceData(String(slug || "").toLowerCase(), { includeSourceCounts: false });
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
        <h2>{data.playlist.name} — Classic editor</h2>
        <p className={styles.hint}>
          This is the previous editor.{" "}
          <Link href={`/dashboard/playlists/${encodeURIComponent(data.playlist.slug)}`}>Back to the new workspace</Link>
        </p>
      </section>
      <PlaylistEditor
        key={data.playlist.slug}
        playlistSlug={data.playlist.slug}
        playlistName={data.playlist.name}
        playlistUrl={data.playlistUrl}
        initialChannels={data.channels}
        initialGroups={data.savedGroups || []}
      />
    </>
  );
}
