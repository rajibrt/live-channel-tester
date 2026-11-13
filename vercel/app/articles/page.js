import Link from "next/link";
import { getPublicArticles, localizeArticle } from "../../lib/publicArticles";
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

const PAGE_SIZE = 12;

const COPY = {
  en: {
    latestLead: "Articles",
    kicker: "WEBTVBD Guides",
    title: "Guides and explainers for better viewing",
    intro: "Practical help with TVs, streaming, radio and home networks, plus the story of broadcasting in Bangladesh — written and reviewed by the WEBTVBD Editorial Desk.",
    featured: "Featured",
    latest: "Latest articles",
    count: "articles",
    standards: "How we publish",
    readMore: "Read article",
    readingTime: "min read",
    pageLabel: "Page",
    previous: "Previous",
    next: "Next",
  },
  bn: {
    latestLead: "আর্টিকেল",
    kicker: "WEBTVBD গাইড",
    featured: "নির্বাচিত",
    latest: "সাম্প্রতিক আর্টিকেল",
    count: "টি আর্টিকেল",
    title: "ভালোভাবে দেখার জন্য গাইড ও ব্যাখ্যা",
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
  const [locale, params, allArticles] = await Promise.all([
    getLocaleFromRequest(),
    searchParams,
    getPublicArticles(),
  ]);
  // each article in the viewer's language when that edition exists
  const articles = allArticles.map((item) => localizeArticle(item, locale));
  const copy = COPY[locale] || COPY.en;
  const totalPages = Math.max(1, Math.ceil(articles.length / PAGE_SIZE));
  const currentPage = Math.min(totalPages, Math.max(1, Number.parseInt(String(params?.page || "1"), 10) || 1));
  const paginatedArticles = articles.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1);

  const showFeatured = currentPage === 1 && paginatedArticles.length > 3;
  const lead = showFeatured ? paginatedArticles[0] : null;
  const side = showFeatured ? paginatedArticles.slice(1, 3) : [];
  const gridItems = showFeatured ? paginatedArticles.slice(3) : paginatedArticles;
  const meta = (article) => (
    <span className={styles.alMeta}>
      {formatDate(article.updatedAt || article.publishedAt, locale)} · {article.readingMinutes} {copy.readingTime}
    </span>
  );

  return (
    <main className={styles.alShell}>
      <header className={styles.alHeader}>
        <p className={styles.adKicker}>{copy.kicker}</p>
        <h1 className={styles.alTitle}>{copy.title}</h1>
        <p className={styles.alIntro}>{copy.intro}</p>
        <p className={styles.alHeaderMeta}>
          <span>{articles.length} {copy.count}</span>
          <span aria-hidden="true">·</span>
          <Link href="/editorial-policy">{copy.standards}</Link>
        </p>
      </header>

      {lead ? (
        <section className={styles.alFeatured} aria-label={copy.featured}>
          <Link href={lead.path} className={styles.alLead} lang={lead.language}>
            {lead.featuredImageUrl ? (
              <img src={lead.featuredImageUrl} alt="" width="1600" height="900" fetchPriority="high" decoding="async" />
            ) : <span className={styles.adCardNoImage} />}
            <div className={styles.alLeadCopy}>
              <span className={styles.alBadge}>{copy.featured}</span>
              <h2>{lead.title}</h2>
              <p>{lead.description}</p>
              {meta(lead)}
            </div>
          </Link>
          <div className={styles.alSide}>
            {side.map((article) => (
              <Link key={article.slug} href={article.path} className={styles.alSideCard} lang={article.language}>
                {article.featuredImageUrl ? (
                  <img src={article.featuredImageUrl} alt="" width="640" height="360" loading="lazy" decoding="async" />
                ) : <span className={styles.adCardNoImage} />}
                <div>
                  <h3>{article.title}</h3>
                  {meta(article)}
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className={styles.alLatest}>
        <h2 className={styles.alSectionTitle}>{copy.latest}</h2>
        <div className={styles.adRelatedGrid}>
          {gridItems.map((article) => (
            <Link key={article.slug} href={article.path} className={styles.adCard} lang={article.language}>
              {article.featuredImageUrl ? (
                <img src={article.featuredImageUrl} alt="" width="640" height="360" loading="lazy" decoding="async" />
              ) : <span className={styles.adCardNoImage} />}
              <div>
                {meta(article)}
                <h3>{article.title}</h3>
                <p>{article.excerpt}</p>
              </div>
            </Link>
          ))}
        </div>
        {totalPages > 1 ? (
          <nav className={styles.alPager} aria-label="Articles pagination">
            <Link
              href={buildArticlesPageHref(currentPage - 1)}
              className={currentPage <= 1 ? styles.alPagerOff : undefined}
              aria-disabled={currentPage <= 1}
              tabIndex={currentPage <= 1 ? -1 : undefined}
            >
              ← {copy.previous}
            </Link>
            <div>
              {pageNumbers.map((pageNumber) => (
                <Link
                  key={pageNumber}
                  href={buildArticlesPageHref(pageNumber)}
                  className={pageNumber === currentPage ? styles.alPagerOn : undefined}
                  aria-current={pageNumber === currentPage ? "page" : undefined}
                  aria-label={`${copy.pageLabel} ${pageNumber}`}
                >
                  {pageNumber}
                </Link>
              ))}
            </div>
            <Link
              href={buildArticlesPageHref(currentPage + 1)}
              className={currentPage >= totalPages ? styles.alPagerOff : undefined}
              aria-disabled={currentPage >= totalPages}
              tabIndex={currentPage >= totalPages ? -1 : undefined}
            >
              {copy.next} →
            </Link>
          </nav>
        ) : null}
      </section>
    </main>
  );
}
