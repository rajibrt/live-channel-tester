"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useI18n } from "../i18n/LanguageProvider";
import styles from "./public-pages.module.css";

export default function PublicHomePage({ featuredArticles = [] }) {
  const { t } = useI18n();
  const heroArticles = featuredArticles.slice(0, 3);
  const [activeIndex, setActiveIndex] = useState(0);
  const heroArticle = heroArticles[activeIndex] || featuredArticles[0] || null;
  const editorialIntro = t("publicSite.editorialIntro");

  useEffect(() => {
    setActiveIndex(0);
  }, [featuredArticles.length]);

  useEffect(() => {
    if (heroArticles.length <= 1) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % heroArticles.length);
    }, 4200);

    return () => window.clearInterval(timer);
  }, [heroArticles.length]);

  return (
    <main className={styles.landingShell}>
      <section className={styles.homeHeroSection}>
        <div className={styles.homeHeroBackdrop}>
          {heroArticles.length ? (
            heroArticles.map((article, index) =>
              article?.featuredImageUrl ? (
                <img
                  key={article.slug}
                  src={article.featuredImageUrl}
                  alt={article.title}
                  className={`${styles.homeHeroImage} ${index === activeIndex ? styles.homeHeroImageActive : ""}`}
                  loading={index === 0 ? "eager" : "lazy"}
                />
              ) : null
            )
          ) : heroArticle?.featuredImageUrl ? (
            <img src={heroArticle.featuredImageUrl} alt={heroArticle.title} className={`${styles.homeHeroImage} ${styles.homeHeroImageActive}`} loading="eager" />
          ) : null}
        </div>
        <div className={styles.homeHeroOverlay}>
          {heroArticle ? (
            <article key={heroArticle.slug} className={styles.homeHeroFeatureCard}>
              {heroArticle.featuredImageUrl ? (
                <img
                  src={heroArticle.featuredImageUrl}
                  alt={heroArticle.title}
                  className={styles.homeHeroCardImage}
                  loading="lazy"
                />
              ) : null}
              <p className={styles.articleMeta}>
                <span>{heroArticle.readingMinutes} {t("publicSite.readingMinutes")}</span>
              </p>
              <h2>{heroArticle.title}</h2>
              <p>{heroArticle.excerpt}</p>
              <Link href={heroArticle.path} className={styles.primaryLink}>
                {t("publicSite.readArticle")}
              </Link>
              {heroArticles.length > 1 ? (
                <div className={styles.homeHeroIndicators} aria-label="Hero article slides">
                  {heroArticles.map((article, index) => (
                    <button
                      key={article.slug}
                      type="button"
                      className={`${styles.homeHeroIndicator} ${index === activeIndex ? styles.homeHeroIndicatorActive : ""}`}
                      aria-label={`Show slide ${index + 1}`}
                      aria-pressed={index === activeIndex}
                      onClick={() => setActiveIndex(index)}
                    />
                  ))}
                </div>
              ) : null}
            </article>
          ) : null}
        </div>
      </section>

      <section className={styles.homeArticleSection}>
        <div className={styles.sectionHeading}>
          <p className={styles.eyebrow}>{t("publicSite.editorialEyebrow")}</p>
          <h2>{t("publicSite.editorialTitle")}</h2>
          {editorialIntro && editorialIntro !== "publicSite.editorialIntro" ? <p>{editorialIntro}</p> : null}
        </div>
        <div className={styles.articleFeaturedGrid}>
          {featuredArticles.map((article) => (
            <article key={article.slug} className={styles.featuredArticleCard}>
              {article.featuredImageUrl ? (
                <img src={article.featuredImageUrl} alt={article.title} className={styles.articleCardImage} loading="lazy" />
              ) : null}
              <p className={styles.articleMeta}>
                <span>{article.readingMinutes} {t("publicSite.readingMinutes")}</span>
              </p>
              <h3>{article.title}</h3>
              <p>{article.excerpt}</p>
              <Link href={article.path} className={styles.primaryLink}>
                {t("publicSite.readArticle")}
              </Link>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
