import styles from "../page.module.css";
import CreatePlaylistForm from "./CreatePlaylistForm";

export default function PlaylistsPage() {
  return (
    <section className={styles.grid}>
      <article className={styles.card}>
        <h2>Create / Update Playlist</h2>
        <CreatePlaylistForm />
      </article>

      <article className={styles.card}>
        <h2>Generate Permanent Token</h2>
        <form method="post" action="/api/admin/tokens" className={styles.form}>
          <label className={styles.field}>
            <span>Playlist Slug</span>
            <input name="playlist_slug" placeholder="playlist slug" required />
          </label>
          <button type="submit" className={styles.primaryBtn}>Generate / Rotate Token</button>
        </form>
      </article>
    </section>
  );
}
