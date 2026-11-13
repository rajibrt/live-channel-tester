import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { getLocaleFromRequest } from "../../../lib/i18n/server";
import { getPublicArticleBySlug, getPublicArticles, localizeArticle } from "../../../lib/publicArticles";
import ArticleShareActions from "../../../components/site/ArticleShareActions";
import ArticleToc from "../../../components/site/ArticleToc";
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
    shareTitle: "Share this article",
    shareOn: "Share on",
    copyLink: "Copy link",
    copied: "Link copied",
    copyFailed: "Could not copy link",
    home: "Home",
    articles: "Articles",
    onThisPage: "On this page",
    relatedTitle: "Related articles",
    allArticles: "All articles",
    editionNote: "This article is currently available in Bangla only.",
    guide: "Guide",
    published: "Published",
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
    shareTitle: "আর্টিকেলটি শেয়ার করুন",
    shareOn: "শেয়ার করুন",
    copyLink: "লিংক কপি করুন",
    copied: "লিংক কপি হয়েছে",
    copyFailed: "লিংক কপি করা যায়নি",
    home: "হোম",
    articles: "আর্টিকেল",
    onThisPage: "এই লেখায়",
    relatedTitle: "আরও পড়ুন",
    allArticles: "সব আর্টিকেল",
    editionNote: "এই আর্টিকেলটি এখন শুধু ইংরেজিতে পাওয়া যাচ্ছে।",
    guide: "গাইড",
    published: "প্রকাশিত",
  },
};

// Gives every h2 an id and returns the list, for the "On this page" navigation.
function withHeadingIds(html) {
  const toc = [];
  let n = 0;
  const out = String(html || "").replace(/<h2(\s[^>]*)?>([\s\S]*?)<\/h2>/gi, (_m, attrs, inner) => {
    n += 1;
    const id = `section-${n}`;
    toc.push({ id, text: inner.replace(/<[^>]+>/g, "").trim() });
    return `<h2 id="${id}"${attrs || ""}>${inner}</h2>`;
  });
  return { html: out, toc };
}

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
  const article = localizeArticle(await getPublicArticleBySlug(resolved?.article), await getLocaleFromRequest());
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
    title: `${article.seoTitle || article.title} | WEBTVBD`,
    description: article.description,
    alternates: { canonical: article.canonicalUrl },
    openGraph: {
      type: "article",
      url: article.canonicalUrl,
      title: article.seoTitle || article.title,
      description: article.description,
      images: socialImage,
    },
    twitter: {
      card: "summary_large_image",
      title: article.seoTitle || article.title,
      description: article.description,
      images: socialImageUrl ? [socialImageUrl] : [],
    },
  };
}

export default async function ArticleDetailPage({ params }) {
  const resolved = await params;
  const [locale, rawArticle, allArticles] = await Promise.all([
    getLocaleFromRequest(),
    getPublicArticleBySlug(resolved?.article),
    getPublicArticles(),
  ]);
  const copy = COPY[locale] || COPY.en;
  if (!rawArticle) notFound();
  const article = localizeArticle(rawArticle, locale);

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

  // related: prefer articles that exist in the viewer's language, newest first
  const related = allArticles
    .filter((item) => item.slug !== article.slug)
    .map((item) => localizeArticle(item, locale))
    .sort((a, b) => Number(b.hasEdition) - Number(a.hasEdition))
    .slice(0, 3);
  const { html, toc } = withHeadingIds(article.html);
  const siteRoot = article.canonicalUrl.replace(/\/articles\/.+$/, "");

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.description,
    inLanguage: article.language,
    image: article.socialImageUrl || undefined,
    datePublished: article.publishedAt || article.updatedAt,
    dateModified: article.updatedAt || article.publishedAt,
    mainEntityOfPage: article.canonicalUrl,
    publisher: { "@type": "Organization", name: "WEBTVBD", url: siteRoot },
    author: { "@type": "Organization", name: "WEBTVBD Editorial Desk", url: `${siteRoot}/editorial-team` },
  };
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteRoot },
      { "@type": "ListItem", position: 2, name: "Articles", item: `${siteRoot}/articles` },
      { "@type": "ListItem", position: 3, name: article.title, item: article.canonicalUrl },
    ],
  };
  const shareLabels = {
    shareTitle: copy.shareTitle,
    shareOn: copy.shareOn,
    copyLink: copy.copyLink,
    copied: copy.copied,
    copyFailed: copy.copyFailed,
  };

  return (
    <main className={styles.adShell}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify([articleJsonLd, breadcrumbJsonLd]) }} />
      <article className={styles.adArticle} lang={article.language}>
        <header className={styles.adHeader}>
          <nav className={styles.adCrumbs} aria-label="Breadcrumb">
            <Link href="/">{copy.home}</Link>
            <span aria-hidden="true">/</span>
            <Link href="/articles">{copy.articles}</Link>
          </nav>
          <p className={styles.adKicker}>{copy.guide}</p>
          <h1 className={styles.adTitle}>{article.title}</h1>
          <p className={styles.adDek}>{article.description}</p>
          <div className={styles.adByline}>
            <img src="/logo.png" alt="" width="40" height="40" className={styles.adAvatar} />
            <div className={styles.adBylineText}>
              <Link href="/editorial-team" className={styles.adAuthor}>{copy.byline}</Link>
              <span>
                {copy.updated} {formatDate(article.updatedAt || article.publishedAt, locale)} · {article.readingMinutes} {copy.readingTime}
              </span>
            </div>
          </div>
          {!article.hasEdition ? <p className={styles.adEditionNote}>{copy.editionNote}</p> : null}
        </header>

        {article.featuredImageUrl ? (
          <figure className={styles.adFigure}>
            <img
              src={article.featuredImageUrl}
              alt={article.title}
              width="1600"
              height="900"
              fetchPriority="high"
              decoding="async"
            />
          </figure>
        ) : null}

        <div className={styles.adLayout}>
          <div className={styles.adMain}>
            <section className={styles.adBody} dangerouslySetInnerHTML={{ __html: html }} />
            <footer className={styles.adFooter}>
              <ArticleShareActions title={article.title} url={article.canonicalUrl} labels={shareLabels} />
              <p className={styles.adPolicy}>
                <Link href="/editorial-policy">{copy.reviewed}</Link>
                <span aria-hidden="true"> · </span>
                <Link href="/contact">{copy.correction}</Link>
              </p>
            </footer>
          </div>
          {toc.length > 1 ? (
            <aside className={styles.adAside}>
              <ArticleToc items={toc} label={copy.onThisPage} />
            </aside>
          ) : null}
        </div>
      </article>

      {related.length ? (
        <section className={styles.adRelated} aria-labelledby="related-title">
          <div className={styles.adRelatedHead}>
            <h2 id="related-title">{copy.relatedTitle}</h2>
            <Link href="/articles">{copy.allArticles} →</Link>
          </div>
          <div className={styles.adRelatedGrid}>
            {related.map((item) => (
              <Link key={item.slug} href={item.path} className={styles.adCard} lang={item.language}>
                {item.featuredImageUrl ? (
                  <img src={item.featuredImageUrl} alt="" width="640" height="360" loading="lazy" />
                ) : (
                  <span className={styles.adCardNoImage} />
                )}
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.excerpt}</p>
                  <span>{item.readingMinutes} {copy.readingTime}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
