import Link from "next/link";
import { getPublicArticles } from "../../lib/publicArticles";
import { getLocaleFromRequest } from "../../lib/i18n/server";
import { localizeArticles } from "../../lib/articleLocalization";
import styles from "../../components/site/public-pages.module.css";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "WEBTVBD Articles",
  description: "Guides, editorial explainers, and platform updates published on WEBTVBD.",
};

const PAGE_SIZE = 9;

const COPY = {
  en: {
    latestLead: "Articles",
    readMore: "Read article",
    readingTime: "min read",
    pageLabel: "Page",
    previous: "Previous",
    next: "Next",
  },
  bn: {
    latestLead: "আর্টিকেল",
    readMore: "আর্টিকেল পড়ুন",
    readingTime: "মিনিট পড়া",
    pageLabel: "পৃষ্ঠা",
    previous: "আগের",
    next: "পরের",
  },
};

function formatDate(value, locale) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

function buildArticlesPageHref(pageNumber) {
  const page = Math.max(1, Number(pageNumber) || 1);
  return page <= 1 ? "/articles" : `/articles?page=${page}`;
}

export default async function ArticlesPage({ searchParams }) {
  const locale = await getLocaleFromRequest();
  const params = await searchParams;
  const copy = COPY[locale] || COPY.en;
  const articles = await localizeArticles(await getPublicArticles(), locale);
  const totalPages = Math.max(1, Math.ceil(articles.length / PAGE_SIZE));
  const currentPage = Math.min(totalPages, Math.max(1, Number.parseInt(String(params?.page || "1"), 10) || 1));
  const paginatedArticles = articles.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1);

  return (
    <main className={styles.shell}>
      <section className={styles.articleShell}>
        <section className={styles.section}>
          <div className={styles.sectionHeading}>
            <h2>{copy.latestLead}</h2>
          </div>
          <div className={styles.articleLatestGrid}>
            {paginatedArticles.map((article) => (
              <Link key={article.slug} href={article.path} className={styles.articleLatestCard}>
                {article.featuredImageUrl ? (
                  <img src={article.featuredImageUrl} alt={article.title} className={styles.articleLatestImage} loading="lazy" />
                ) : null}
                <div className={styles.articleLatestCopy}>
                  <p className={styles.articleMeta}>
                    <span>{formatDate(article.updatedAt || article.publishedAt, locale)}</span>
                    <span>{article.readingMinutes} {copy.readingTime}</span>
                  </p>
                  <h3>{article.title}</h3>
                  <p>{article.excerpt}</p>
                </div>
                <span className={styles.secondaryLink}>
                  {copy.readMore}
                </span>
              </Link>
            ))}
          </div>
          {totalPages > 1 ? (
            <nav className={styles.paginationNav} aria-label="Articles pagination">
              <Link
                href={buildArticlesPageHref(currentPage - 1)}
                className={`${styles.paginationLink} ${currentPage <= 1 ? styles.paginationDisabled : ""}`}
                aria-disabled={currentPage <= 1}
                tabIndex={currentPage <= 1 ? -1 : undefined}
              >
                {copy.previous}
              </Link>
              <div className={styles.paginationPages}>
                {pageNumbers.map((pageNumber) => (
                  <Link
                    key={pageNumber}
                    href={buildArticlesPageHref(pageNumber)}
                    className={`${styles.paginationLink} ${pageNumber === currentPage ? styles.paginationActive : ""}`}
                    aria-current={pageNumber === currentPage ? "page" : undefined}
                  >
                    <span className={styles.paginationLabel}>{copy.pageLabel}</span> {pageNumber}
                  </Link>
                ))}
              </div>
              <Link
                href={buildArticlesPageHref(currentPage + 1)}
                className={`${styles.paginationLink} ${currentPage >= totalPages ? styles.paginationDisabled : ""}`}
                aria-disabled={currentPage >= totalPages}
                tabIndex={currentPage >= totalPages ? -1 : undefined}
              >
                {copy.next}
              </Link>
            </nav>
          ) : null}
        </section>
      </section>
    </main>
  );
}
