import styles from "../page.module.css";
import ManageAnnouncements from "../announcements/ManageAnnouncements";
import { getAnnouncementItems } from "../announcements/data";

export default async function ArticlesPage() {
  const { items, error } = await getAnnouncementItems();
  return (
    <section className={styles.card}>
      <ManageAnnouncements initialItems={items} loadError={error} mode="articles" />
    </section>
  );
}
