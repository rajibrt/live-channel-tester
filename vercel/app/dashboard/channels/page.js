import styles from "../page.module.css";

export default function ChannelsPage() {
  return (
    <section className={styles.card}>
      <h2>Add / Update Channel + Attach Playlist</h2>
      <form method="post" action="/api/admin/channels" className={styles.formGrid}>
        <label className={styles.field}>
          <span>Playlist Slug</span>
          <input name="playlist_slug" placeholder="playlist slug" required />
        </label>
        <label className={styles.field}>
          <span>Channel Name</span>
          <input name="name" placeholder="channel name" required />
        </label>
        <label className={`${styles.field} ${styles.full}`}>
          <span>Stream URL</span>
          <input name="stream_url" placeholder="stream url" required />
        </label>
        <label className={styles.field}>
          <span>Category</span>
          <input name="category" placeholder="category" />
        </label>
        <label className={styles.field}>
          <span>Logo URL</span>
          <input name="logo_url" placeholder="logo url" />
        </label>
        <button type="submit" className={`${styles.primaryBtn} ${styles.full}`}>Save Channel</button>
      </form>
    </section>
  );
}
