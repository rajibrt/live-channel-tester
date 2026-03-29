import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocaleFromRequest } from "../../../lib/i18n/server";
import { getPublicArticleBySlug, getPublicArticles } from "../../../lib/publicArticles";
import { localizeArticle, localizeArticles } from "../../../lib/articleLocalization";
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
  },
  bn: {
    eyebrow: "WEBTVBD আর্টিকেল",
    back: "আর্টিকেল লিস্টে ফিরুন",
    updated: "সর্বশেষ আপডেট",
    readingTime: "মিনিট পড়া",
    related: "WEBTVBD থেকে আরও পড়ুন",
    readArticle: "আর্টিকেল পড়ুন",
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

export async function generateMetadata({ params }) {
  const resolved = await params;
  const article = await getPublicArticleBySlug(resolved?.article);
  if (!article) {
    return {
      title: "Article Not Found | WEBTVBD",
      robots: { index: false, follow: false },
    };
  }

  const socialImage = article.featuredImageUrl
    ? [
        {
          url: article.featuredImageUrl,
          width: 1200,
          height: 630,
          alt: article.title,
        },
      ]
    : undefined;

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
      images: socialImage,
    },
  };
}

export default async function ArticleDetailPage({ params }) {
  const resolved = await params;
  const locale = await getLocaleFromRequest();
  const copy = COPY[locale] || COPY.en;
  const article = await localizeArticle(await getPublicArticleBySlug(resolved?.article), locale);
  if (!article) notFound();

  const allArticles = await localizeArticles(await getPublicArticles(), locale);
  const related = allArticles.filter((item) => item.slug !== article.slug).slice(0, 3);
  const jsonLd = {
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
    },
  };

  return (
    <main className={styles.shell}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <article className={styles.articleDetailShell}>
        <Link href="/articles" className={styles.secondaryLink}>{copy.back}</Link>
        <div className={styles.articleDetailContentGrid}>
          <div className={styles.articleMainColumn}>
            <header className={styles.articleDetailHeader}>
              <p className={styles.eyebrow}>{copy.eyebrow}</p>
              <h1 className={styles.title}>{article.title}</h1>
              <p className={styles.articleMeta}>
                <span>{copy.updated}: {formatDate(article.updatedAt || article.publishedAt, locale)}</span>
                <span>{article.readingMinutes} {copy.readingTime}</span>
              </p>
              <p className={styles.intro}>{article.description}</p>
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
