import styles from "./dashboard/page.module.css";

export default function AppLoading() {
  return (
    <section className={styles.card}>
      <div className={`${styles.skeleton} ${styles.skeletonTitle}`} />
      <div className={`${styles.skeleton} ${styles.skeletonText}`} />
      <div className={`${styles.skeleton} ${styles.skeletonRow}`} />
      <div className={`${styles.skeleton} ${styles.skeletonRow}`} />
    </section>
  );
}
