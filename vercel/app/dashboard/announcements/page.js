import styles from "../page.module.css";
import ManageAnnouncements from "./ManageAnnouncements";
import { getAnnouncementItems } from "./data";

export default async function AnnouncementsPage() {
  const { items, error } = await getAnnouncementItems();
  return (
    <section className={styles.card}>
      <ManageAnnouncements initialItems={items} loadError={error} mode="announcements" />
    </section>
  );
}
