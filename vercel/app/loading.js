import styles from "./loading.module.css";

export default function AppLoading() {
  return (
    <main className={styles.loadingRoot} aria-label="Loading homepage">
      <section className={styles.loadingFrame}>
        <header className={styles.topBar}>
          <div className={styles.brandRow}>
            <div className={`${styles.skeleton} ${styles.brandLogo}`} />
            <div className={`${styles.skeleton} ${styles.brandText}`} />
          </div>
          <div className={styles.topActions}>
            <div className={`${styles.skeleton} ${styles.actionPill}`} />
            <div className={`${styles.skeleton} ${styles.actionIcon}`} />
            <div className={`${styles.skeleton} ${styles.actionIcon}`} />
            <div className={`${styles.skeleton} ${styles.actionIcon}`} />
          </div>
        </header>

        <section className={styles.contentArea}>
          <aside className={styles.leftCol}>
            <div className={`${styles.skeleton} ${styles.searchBar}`} />
            <div className={styles.listStack}>
              <div className={`${styles.skeleton} ${styles.listRow}`} />
              <div className={`${styles.skeleton} ${styles.listRow}`} />
              <div className={`${styles.skeleton} ${styles.listRow}`} />
              <div className={`${styles.skeleton} ${styles.listRow}`} />
              <div className={`${styles.skeleton} ${styles.listRow}`} />
            </div>
          </aside>

          <section className={styles.centerCol}>
            <div className={`${styles.skeleton} ${styles.videoShell}`} />
            <div className={`${styles.skeleton} ${styles.controlBar}`} />
            <div className={`${styles.skeleton} ${styles.infoCard}`} />
          </section>

          <aside className={styles.rightCol}>
            <div className={`${styles.skeleton} ${styles.rightTitle}`} />
            <div className={`${styles.skeleton} ${styles.searchBar}`} />
            <div className={styles.listStack}>
              <div className={`${styles.skeleton} ${styles.channelCard}`} />
              <div className={`${styles.skeleton} ${styles.channelCard}`} />
              <div className={`${styles.skeleton} ${styles.channelCard}`} />
              <div className={`${styles.skeleton} ${styles.channelCard}`} />
            </div>
          </aside>
        </section>
      </section>
    </main>
  );
}
