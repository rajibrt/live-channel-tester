import Link from "next/link";
import { getFeaturedPublicArticles, getPublicArticles } from "../../lib/publicArticles";
import { getLocaleFromRequest } from "../../lib/i18n/server";
import { localizeArticles } from "../../lib/articleLocalization";
import styles from "../../components/site/public-pages.module.css";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "WEBTVBD Articles",
  description: "Guides, editorial explainers, and platform updates published on WEBTVBD.",
};

const COPY = {
  en: {
    eyebrow: "Articles",
    title: "Guides, explainers, and platform updates",
    intro:
      "This section collects editorial content that explains how WEBTVBD works, how viewers can use the platform more effectively, and what public information matters before playback begins.",
    overviewLabel: "Editorial overview",
    totalArticles: "Published guides",
    updatedLabel: "Latest refresh",
    featured: "Featured reading",
    latestLead: "Latest articles",
    latest: "Latest articles",
    latestIntro: "Recent editorial posts, platform notes, and public-facing guides in one stream.",
    readMore: "Read article",
    readingTime: "min read",
  },
  bn: {
    eyebrow: "আর্টিকেল",
    title: "গাইড, ব্যাখ্যামূলক লেখা এবং প্ল্যাটফর্ম আপডেট",
    intro:
      "এই সেকশনে WEBTVBD কীভাবে কাজ করে, ভিউয়াররা কীভাবে প্ল্যাটফর্ম ভালোভাবে ব্যবহার করতে পারে, এবং প্লেব্যাকের আগে কোন পাবলিক তথ্য গুরুত্বপূর্ণ তা ব্যাখ্যা করা হয়েছে।",
    overviewLabel: "এডিটোরিয়াল ওভারভিউ",
    totalArticles: "প্রকাশিত গাইড",
    updatedLabel: "সর্বশেষ আপডেট",
    featured: "ফিচারড রিডিং",
    latestLead: "সর্বশেষ আর্টিকেল",
    latest: "সর্বশেষ আর্টিকেল",
    latestIntro: "সাম্প্রতিক এডিটোরিয়াল পোস্ট, প্ল্যাটফর্ম নোট এবং পাবলিক গাইড একসাথে দেখুন।",
    readMore: "আর্টিকেল পড়ুন",
    readingTime: "মিনিট পড়া",
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

export default async function ArticlesPage() {
  const locale = await getLocaleFromRequest();
  const copy = COPY[locale] || COPY.en;
  const [featuredRaw, articlesRaw] = await Promise.all([
    getFeaturedPublicArticles(3),
    getPublicArticles(),
  ]);
  const [featured, articles] = await Promise.all([
    localizeArticles(featuredRaw, locale),
    localizeArticles(articlesRaw, locale),
  ]);
  const leadArticle = featured[0] || articles[0] || null;
  const supportingArticles = (featured.length ? featured.slice(1) : articles.slice(1, 3)).filter(Boolean);
  const featuredIds = new Set(featured.map((item) => item.slug));
  const latestArticles = (articles.filter((item) => !featuredIds.has(item.slug)).length
    ? articles.filter((item) => !featuredIds.has(item.slug))
    : articles
  ).filter((item) => item.slug !== leadArticle?.slug);
  const latestRefresh = leadArticle ? formatDate(leadArticle.updatedAt || leadArticle.publishedAt, locale) : "";

  return (
    <main className={styles.shell}>
      <section className={styles.articleShell}>
        <header className={styles.articleLandingHero}>
          <div className={styles.articleLandingCopy}>
            <p className={styles.eyebrow}>{copy.eyebrow}</p>
            <h1 className={styles.title}>{copy.title}</h1>
            <p className={styles.intro}>{copy.intro}</p>
          </div>
          <div className={styles.articleLandingPanel}>
            <p className={styles.articleLandingLabel}>{copy.overviewLabel}</p>
            <div className={styles.articleLandingStats}>
              <article className={styles.articleLandingStat}>
                <span>{copy.totalArticles}</span>
                <strong>{articles.length}</strong>
              </article>
              <article className={styles.articleLandingStat}>
                <span>{copy.updatedLabel}</span>
                <strong>{latestRefresh || "-"}</strong>
              </article>
            </div>
          </div>
        </header>

        <section className={styles.articleFeatureStage}>
          <div className={styles.sectionHeading}>
            <h2>{copy.featured}</h2>
          </div>
          <div className={styles.articleFeatureGrid}>
            {leadArticle ? (
              <article className={styles.articleLeadCard}>
                {leadArticle.featuredImageUrl ? (
                  <img src={leadArticle.featuredImageUrl} alt={leadArticle.title} className={styles.articleLeadImage} loading="lazy" />
                ) : null}
                <div className={styles.articleLeadBody}>
                  <p className={styles.articleMeta}>
                    <span>{formatDate(leadArticle.updatedAt || leadArticle.publishedAt, locale)}</span>
                    <span>{leadArticle.readingMinutes} {copy.readingTime}</span>
                  </p>
                  <h2>{leadArticle.title}</h2>
                  <p>{leadArticle.excerpt}</p>
                  <Link href={leadArticle.path} className={styles.primaryLink}>
                    {copy.readMore}
                  </Link>
                </div>
              </article>
            ) : null}

            <div className={styles.articleSupportRail}>
              {supportingArticles.map((article) => (
                <article key={article.slug} className={styles.articleSupportCard}>
                  {article.featuredImageUrl ? (
                    <img src={article.featuredImageUrl} alt={article.title} className={styles.articleSupportImage} loading="lazy" />
                  ) : null}
                  <div className={styles.articleSupportCopy}>
                    <p className={styles.articleMeta}>
                      <span>{formatDate(article.updatedAt || article.publishedAt, locale)}</span>
                      <span>{article.readingMinutes} {copy.readingTime}</span>
                    </p>
                    <h3>{article.title}</h3>
                    <p>{article.excerpt}</p>
                    <Link href={article.path} className={styles.secondaryLink}>
                      {copy.readMore}
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeading}>
            <h2>{copy.latestLead}</h2>
            <p>{copy.latestIntro}</p>
          </div>
          <div className={styles.articleLatestGrid}>
            {latestArticles.map((article) => (
              <article key={article.slug} className={styles.articleLatestCard}>
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
                <Link href={article.path} className={styles.secondaryLink}>
                  {copy.readMore}
                </Link>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
