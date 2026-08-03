import publicStyles from "../../../components/site/public-pages.module.css";
import styles from "./article-loading.module.css";

function Line({ width = "100%", height = "14px" }) {
  return <span className={styles.skeleton} style={{ width, height }} aria-hidden="true" />;
}

function RelatedCardSkeleton() {
  return (
    <div className={styles.relatedCard} aria-hidden="true">
      <span className={`${styles.skeleton} ${styles.relatedImage}`} />
      <Line width="84%" height="18px" />
      <Line width="100%" />
      <Line width="68%" />
    </div>
  );
}

export default function ArticleDetailLoading() {
  return (
    <main className={publicStyles.shell} aria-busy="true" aria-label="Loading article">
      <article className={publicStyles.articleDetailShell}>
        <span className={`${styles.skeleton} ${styles.backLink}`} aria-hidden="true" />

        <div className={publicStyles.articleDetailContentGrid}>
          <div className={publicStyles.articleMainColumn}>
            <header className={`${publicStyles.articleDetailHeader} ${styles.header}`}>
              <Line width="132px" height="12px" />
              <div className={styles.titleLines}>
                <Line width="94%" height="42px" />
                <Line width="66%" height="42px" />
              </div>
              <div className={styles.metaRow} aria-hidden="true">
                <Line width="150px" />
                <Line width="88px" />
                <Line width="180px" />
              </div>
              <div className={styles.introLines}>
                <Line />
                <Line width="88%" />
              </div>
            </header>

            <span className={`${styles.skeleton} ${styles.heroImage}`} aria-hidden="true" />

            <section className={`${publicStyles.articleBody} ${styles.body}`} aria-hidden="true">
              <Line width="42%" height="28px" />
              <div className={styles.paragraph}>
                <Line />
                <Line />
                <Line width="93%" />
                <Line width="76%" />
              </div>
              <Line width="58%" height="28px" />
              <div className={styles.paragraph}>
                <Line />
                <Line width="96%" />
                <Line width="82%" />
              </div>
              <Line width="48%" height="28px" />
              <div className={styles.paragraph}>
                <Line />
                <Line width="90%" />
                <Line width="70%" />
              </div>
            </section>
          </div>

          <aside className={publicStyles.articleSidebar} aria-hidden="true">
            <section className={styles.relatedSection}>
              <Line width="62%" height="26px" />
              <RelatedCardSkeleton />
              <RelatedCardSkeleton />
              <RelatedCardSkeleton />
            </section>
          </aside>
        </div>
        <span className={styles.srOnly}>আর্টিকেল লোড হচ্ছে</span>
      </article>
    </main>
  );
}
