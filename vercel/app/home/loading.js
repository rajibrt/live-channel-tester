import publicStyles from "../../components/site/public-pages.module.css";
import styles from "./home-loading.module.css";

function Line({ width = "100%", height = "14px" }) {
  return <span className={styles.skeleton} style={{ width, height }} aria-hidden="true" />;
}

function ArticleCardSkeleton() {
  return (
    <article className={styles.articleCard} aria-hidden="true">
      <span className={`${styles.skeleton} ${styles.articleImage}`} />
      <Line width="82px" height="12px" />
      <div className={styles.lineStack}>
        <Line width="94%" height="20px" />
        <Line width="72%" height="20px" />
      </div>
      <div className={styles.lineStack}>
        <Line />
        <Line width="96%" />
        <Line width="78%" />
      </div>
      <Line width="108px" height="15px" />
    </article>
  );
}

export default function PublicHomeLoading() {
  return (
    <main className={publicStyles.landingShell} aria-busy="true" aria-label="Loading public homepage">
      <section className={styles.hero} aria-hidden="true">
        <span className={`${styles.skeleton} ${styles.heroBackdrop}`} />
        <div className={styles.heroOverlay}>
          <div className={styles.heroCopy}>
            <Line width="230px" height="13px" />
            <div className={styles.titleStack}>
              <Line width="100%" height="36px" />
              <Line width="74%" height="36px" />
            </div>
            <div className={styles.metaRow}>
              <Line width="92px" />
              <Line width="44px" />
            </div>
            <div className={styles.lineStack}>
              <Line />
              <Line width="92%" />
              <Line width="68%" />
            </div>
            <div className={styles.actionRow}>
              <Line width="126px" height="44px" />
              <Line width="174px" height="44px" />
            </div>
            <div className={styles.heroControls}>
              <Line width="106px" height="12px" />
              <Line width="112px" height="34px" />
            </div>
          </div>
        </div>
      </section>

      <section className={styles.latestSection} aria-hidden="true">
        <div className={styles.sectionHeader}>
          <div className={styles.sectionCopy}>
            <Line width="126px" height="12px" />
            <Line width="270px" height="38px" />
            <Line width="520px" />
          </div>
          <Line width="176px" height="20px" />
        </div>
        <div className={styles.articleGrid}>
          {Array.from({ length: 6 }, (_, index) => <ArticleCardSkeleton key={index} />)}
        </div>
      </section>
      <span className={styles.srOnly}>হোমপেজ লোড হচ্ছে</span>
    </main>
  );
}
