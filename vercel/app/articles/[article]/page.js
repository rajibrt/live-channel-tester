import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { getLocaleFromRequest } from "../../../lib/i18n/server";
import { getPublicArticleBySlug, getPublicArticles } from "../../../lib/publicArticles";
import styles from "../../../components/site/public-pages.module.css";

export const dynamic = "force-dynamic";

const COPY = {
  en: {
    eyebrow: "WEBTVBD Article",
    back: "Back to articles",
    updated: "Updated",
    readingTime: "min read",
    related: "More from WEBTVBD",
    readArticle: "Read article",
    byline: "By WEBTVBD Editorial Desk",
    reviewed: "Read our editorial standards",
    correction: "Report a correction",
  },
  bn: {
    eyebrow: "WEBTVBD আর্টিকেল",
    back: "আর্টিকেল লিস্টে ফিরুন",
    updated: "সর্বশেষ আপডেট",
    readingTime: "মিনিট পড়া",
    related: "WEBTVBD থেকে আরও পড়ুন",
    readArticle: "আর্টিকেল পড়ুন",
    byline: "WEBTVBD সম্পাদকীয় ডেস্ক",
    reviewed: "আমাদের সম্পাদনা নীতিমালা পড়ুন",
    correction: "সংশোধনের অনুরোধ করুন",
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

function inferImageType(url) {
  const value = String(url || "").toLowerCase();
  if (value.includes(".png")) return "image/png";
  if (value.includes(".jpg") || value.includes(".jpeg")) return "image/jpeg";
  if (value.includes(".webp")) return "image/webp";
  return "image/jpeg";
}

export async function generateMetadata({ params }) {
  const resolved = await params;
  const article = await getPublicArticleBySlug(resolved?.article);
  if (!article) {
    return {
      title: "Article Not Found | WEBTVBD",
      robots: { index: false, follow: false },
    };
  }

  const socialImageUrl = article.featuredImageUrl
    ? `${article.canonicalUrl.replace(/\/+$/, "")}/share-image?v=${encodeURIComponent(article.updatedAt || article.publishedAt || "1")}`
    : (article.socialImageUrl || article.featuredImageUrl || "");
  const socialImage = socialImageUrl
    ? [
        {
          url: socialImageUrl,
          secureUrl: socialImageUrl,
          type: inferImageType(socialImageUrl),
          width: 1200,
          height: 630,
          alt: article.title,
        },
      ]
    : [];

  return {
    title: `${article.title} | WEBTVBD`,
    description: article.description,
    alternates: { canonical: article.canonicalUrl },
    openGraph: {
      type: "article",
      url: article.canonicalUrl,
      title: article.title,
      description: article.description,
      images: socialImage,
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description: article.description,
      images: socialImageUrl ? [socialImageUrl] : [],
    },
  };
}

export default async function ArticleDetailPage({ params }) {
  const resolved = await params;
  const [locale, article, allArticles] = await Promise.all([
    getLocaleFromRequest(),
    getPublicArticleBySlug(resolved?.article),
    getPublicArticles(),
  ]);
  const copy = COPY[locale] || COPY.en;
  if (!article) notFound();

  const related = allArticles.filter((item) => item.slug !== article.slug).slice(0, 3);
  let requestedSlug = String(resolved?.article || "");
  try {
    requestedSlug = decodeURIComponent(requestedSlug);
  } catch {
    // Keep the original route value when it is already decoded or malformed.
  }
  requestedSlug = requestedSlug.normalize("NFKC").toLowerCase();
  const canonicalSlug = String(article.slug || "").normalize("NFKC").toLowerCase();
  if (requestedSlug !== canonicalSlug) {
    permanentRedirect(article.path);
  }

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.description,
    datePublished: article.publishedAt || article.updatedAt,
    dateModified: article.updatedAt || article.publishedAt,
    mainEntityOfPage: article.canonicalUrl,
    publisher: {
      "@type": "Organization",
      name: "WEBTVBD",
      url: article.canonicalUrl.replace(/\/articles\/.+$/, ""),
    },
    author: {
      "@type": "Organization",
      name: "WEBTVBD Editorial Desk",
      url: `${article.canonicalUrl.replace(/\/articles\/.+$/, "")}/editorial-team`,
    },
  };
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: article.canonicalUrl.replace(/\/articles\/.+$/, "") },
      { "@type": "ListItem", position: 2, name: "Articles", item: `${article.canonicalUrl.replace(/\/articles\/.+$/, "")}/articles` },
      { "@type": "ListItem", position: 3, name: article.title, item: article.canonicalUrl },
    ],
  };

  return (
    <main className={styles.shell}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify([articleJsonLd, breadcrumbJsonLd]) }} />
      <article className={styles.articleDetailShell} lang={article.language}>
        <Link href="/articles" className={styles.secondaryLink}>{copy.back}</Link>
        <div className={styles.articleDetailContentGrid}>
          <div className={styles.articleMainColumn}>
            <header className={styles.articleDetailHeader}>
              <p className={styles.eyebrow}>{copy.eyebrow}</p>
              <h1 className={styles.title}>{article.title}</h1>
              <p className={styles.articleMeta}>
                <span>{copy.updated}: {formatDate(article.updatedAt || article.publishedAt, locale)}</span>
                <span>{article.readingMinutes} {copy.readingTime}</span>
                <span><Link href="/editorial-team">{copy.byline}</Link></span>
              </p>
              <p className={styles.intro}>{article.description}</p>
              <p className={styles.articleReviewNote}>
                <Link href="/editorial-policy">{copy.reviewed}</Link>
                <span aria-hidden="true"> · </span>
                <Link href="/contact">{copy.correction}</Link>
              </p>
            </header>

            {article.featuredImageUrl ? (
              <img src={article.featuredImageUrl} alt={article.title} className={styles.articleHeroImage} />
            ) : null}

            <section
              className={styles.articleBody}
              dangerouslySetInnerHTML={{ __html: article.html }}
            />
          </div>

          <aside className={styles.articleSidebar}>
            <section className={styles.section}>
              <h2>{copy.related}</h2>
              <div className={styles.articleList}>
                {related.map((item) => (
                  <Link key={item.slug} href={item.path} className={styles.articleListCard}>
                    {item.featuredImageUrl ? (
                      <img
                        src={item.featuredImageUrl}
                        alt={item.title}
                        className={styles.articleListThumb}
                        loading="lazy"
                      />
                    ) : null}
                    <div className={styles.articleListCopy}>
                      <h3>{item.title}</h3>
                      <p>{item.excerpt}</p>
                    </div>
                    <span className={styles.secondaryLink}>{copy.readArticle}</span>
                  </Link>
                ))}
              </div>
            </section>
          </aside>
        </div>
      </article>
    </main>
  );
}
