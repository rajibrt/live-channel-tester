import styles from "../../page.module.css";
import { getPlaylistWorkspaceData } from "../../../../lib/playlistAdminData";
import PlaylistWorkspace from "./workspace/PlaylistWorkspace";

export const dynamic = "force-dynamic";

const TABS = new Set(["channels", "groups", "health", "settings"]);

export default async function PlaylistWorkspacePage({ params, searchParams }) {
  const { slug } = await params;
  const query = (await searchParams) || {};
  const tab = TABS.has(String(query?.tab || "")) ? String(query.tab) : "channels";
  const data = await getPlaylistWorkspaceData(String(slug || "").toLowerCase());

  if (!data) {
    return (
      <section className={styles.card}>
        <h2>Playlist not found</h2>
        <p className={styles.hint}>No playlist with slug “{slug}”.</p>
      </section>
    );
  }

  return (
    <PlaylistWorkspace
      key={data.playlist.slug}
      initialTab={tab}
      playlist={data.playlist}
      playlistUrl={data.playlistUrl}
      initialChannels={data.channels}
      initialGroups={data.savedGroups}
      initialSourceCounts={data.sourceCounts}
    />
  );
}
