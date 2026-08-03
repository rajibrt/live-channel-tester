import Link from "next/link";
import { getPublicArticles } from "../../lib/publicArticles";
import { getLocaleFromRequest } from "../../lib/i18n/server";
import styles from "../../components/site/public-pages.module.css";

export const dynamic = "force-dynamic";

export async function generateMetadata({ searchParams }) {
  const params = await searchParams;
  const page = Math.max(1, Number.parseInt(String(params?.page || "1"), 10) || 1);
  return {
    title: page > 1 ? `WEBTVBD Articles — Page ${page}` : "WEBTVBD Articles",
    description: "Research-led guides and explainers about television, streaming technology, and digital viewing in Bangladesh.",
    alternates: { canonical: page > 1 ? `/articles?page=${page}` : "/articles" },
  };
}

const PAGE_SIZE = 9;

const COPY = {
  en: {
    latestLead: "Articles",
    title: "Research, guides, and context for better digital viewing",
    intro: "Explore practical device help, Bangladesh broadcasting context, and streaming explainers reviewed by the WEBTVBD Editorial Desk.",
    standards: "How we publish",
    readMore: "Read article",
    readingTime: "min read",
    pageLabel: "Page",
    previous: "Previous",
    next: "Next",
  },
  bn: {
    latestLead: "আর্টিকেল",
    title: "ডিজিটাল দেখার অভিজ্ঞতার জন্য গবেষণা, গাইড ও প্রেক্ষাপট",
    intro: "WEBTVBD Editorial Desk-এর review করা device help, বাংলাদেশের broadcasting context এবং streaming explainer পড়ুন।",
    standards: "আমরা যেভাবে প্রকাশ করি",
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
  const [locale, params, articles] = await Promise.all([
    getLocaleFromRequest(),
    searchParams,
    getPublicArticles(),
  ]);
  const copy = COPY[locale] || COPY.en;
  const totalPages = Math.max(1, Math.ceil(articles.length / PAGE_SIZE));
  const currentPage = Math.min(totalPages, Math.max(1, Number.parseInt(String(params?.page || "1"), 10) || 1));
  const paginatedArticles = articles.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1);

  return (
    <main className={styles.shell}>
      <section className={styles.articleShell}>
        <header className={styles.articleLandingHero}>
          <div className={styles.articleLandingCopy}>
            <p className={styles.eyebrow}>{copy.latestLead}</p>
            <h1 className={styles.title}>{copy.title}</h1>
            <p className={styles.intro}>{copy.intro}</p>
            <div className={styles.actions}>
              <Link href="/editorial-policy" className={styles.secondaryLink}>{copy.standards}</Link>
            </div>
          </div>
          <aside className={styles.articleLandingPanel}>
            <p className={styles.articleLandingLabel}>{copy.latestLead}</p>
            <div className={styles.articleLandingStats}>
              <div className={styles.articleLandingStat}>
                <span>{locale === "bn" ? "প্রকাশিত আর্টিকেল" : "Published articles"}</span>
                <strong>{articles.length}</strong>
              </div>
              <div className={styles.articleLandingStat}>
                <span>{locale === "bn" ? "সম্পাদনা নীতিমালা" : "Editorial standards"}</span>
                <strong>{locale === "bn" ? "সবার জন্য উন্মুক্ত" : "Open to readers"}</strong>
              </div>
            </div>
          </aside>
        </header>
        <section className={styles.section}>
          <div className={styles.sectionHeading}>
            <h2>{copy.latestLead}</h2>
          </div>
          <div className={styles.articleLatestGrid}>
            {paginatedArticles.map((article) => (
              <Link key={article.slug} href={article.path} className={styles.articleLatestCard} lang={article.language}>
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
