import styles from "../page.module.css";
import ManageEmailSettings from "./ManageEmailSettings";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  return (
    <section className={styles.card}>
      <ManageEmailSettings />
    </section>
  );
}
