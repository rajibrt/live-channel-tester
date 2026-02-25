import styles from "./page.module.css";

export default function DashboardSkeleton() {
  return (
    <section className={styles.card}>
      <div className={`${styles.skeleton} ${styles.skeletonTitle}`} />
      <div className={`${styles.skeleton} ${styles.skeletonText}`} />
      <div className={styles.skeletonGrid}>
        <div className={`${styles.skeleton} ${styles.skeletonCard}`}>
          <div className={`${styles.skeleton} ${styles.skeletonBlock}`} />
          <div className={`${styles.skeleton} ${styles.skeletonRow}`} />
          <div className={`${styles.skeleton} ${styles.skeletonRow}`} />
          <div className={`${styles.skeleton} ${styles.skeletonRow}`} />
        </div>
        <div className={`${styles.skeleton} ${styles.skeletonCard}`}>
          <div className={`${styles.skeleton} ${styles.skeletonBlock}`} />
          <div className={`${styles.skeleton} ${styles.skeletonRow}`} />
          <div className={`${styles.skeleton} ${styles.skeletonRow}`} />
          <div className={`${styles.skeleton} ${styles.skeletonRow}`} />
        </div>
      </div>
    </section>
  );
}
