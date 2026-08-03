"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useI18n } from "../i18n/LanguageProvider";
import styles from "./public-pages.module.css";

export default function PublicHomePage({ featuredArticles = [] }) {
  const { t } = useI18n();
  const heroArticles = featuredArticles.filter((article) => article.featuredImageUrl).slice(0, 5);
  const latestArticles = featuredArticles.slice(0, 9);
  const [activeHeroIndex, setActiveHeroIndex] = useState(0);
  const [rotationPaused, setRotationPaused] = useState(false);
  const [interactionPaused, setInteractionPaused] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const activeHeroArticle = heroArticles[activeHeroIndex] || heroArticles[0] || null;

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setPrefersReducedMotion(media.matches);
    updatePreference();
    media.addEventListener?.("change", updatePreference);
    return () => media.removeEventListener?.("change", updatePreference);
  }, []);

  useEffect(() => {
    if (heroArticles.length < 2 || rotationPaused || interactionPaused || prefersReducedMotion) return undefined;
    const timer = window.setInterval(() => {
      setActiveHeroIndex((current) => (current + 1) % heroArticles.length);
    }, 7000);
    return () => window.clearInterval(timer);
  }, [heroArticles.length, interactionPaused, prefersReducedMotion, rotationPaused]);

  return (
    <main className={styles.landingShell}>
      {activeHeroArticle ? (
        <section
          className={styles.homeHeroSection}
          aria-labelledby="featured-article-title"
          onMouseEnter={() => setInteractionPaused(true)}
          onMouseLeave={() => setInteractionPaused(false)}
          onFocusCapture={() => setInteractionPaused(true)}
          onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setInteractionPaused(false);
          }}
        >
          <div className={styles.homeHeroBackdrop} aria-hidden="true">
            {heroArticles.map((article, index) => (
              <Image
                key={article.slug}
                src={article.featuredImageUrl}
                alt=""
                fill
                sizes="(max-width: 720px) 100vw, 1180px"
                priority={index === 0}
                loading={index === 0 ? undefined : "lazy"}
                className={`${styles.homeHeroImage} ${index === activeHeroIndex ? styles.homeHeroImageActive : ""}`}
              />
            ))}
          </div>
          <div className={styles.homeHeroOverlay}>
            <article className={styles.homeHeroFeatureCard} lang={activeHeroArticle.language}>
              <p className={styles.eyebrow}>{t("publicSite.featuredHeroEyebrow")}</p>
              <Link
                href={activeHeroArticle.path}
                className={styles.articleMediaLink}
                aria-label={activeHeroArticle.title}
              >
                <Image
                  key={`hero-card-${activeHeroArticle.slug}`}
                  src={activeHeroArticle.featuredImageUrl}
                  alt={activeHeroArticle.title}
                  width={1000}
                  height={562}
                  sizes="(max-width: 720px) calc(100vw - 72px), 1px"
                  loading="lazy"
                  className={styles.homeHeroCardImage}
                />
              </Link>
              <h1 id="featured-article-title">
                <Link href={activeHeroArticle.path} className={styles.articleTitleLink}>
                  {activeHeroArticle.title}
                </Link>
              </h1>
              <p className={styles.articleMeta}>
                <span>{activeHeroArticle.readingMinutes} {t("publicSite.readingMinutes")}</span>
                <span>{activeHeroIndex + 1} / {heroArticles.length}</span>
              </p>
              <p>{activeHeroArticle.excerpt}</p>
              <div className={styles.homeHeroActions}>
                <Link href={activeHeroArticle.path} className={styles.primaryLink}>{t("publicSite.readArticle")}</Link>
                <Link href="/articles" className={styles.secondaryLink}>{t("publicSite.readLatestGuides")}</Link>
              </div>
              {heroArticles.length > 1 ? (
                <div className={styles.homeHeroControls}>
                  <div className={styles.homeHeroIndicators} aria-label={t("publicSite.featuredHeroNavigation")}>
                    {heroArticles.map((article, index) => (
                      <button
                        key={article.slug}
                        type="button"
                        className={`${styles.homeHeroIndicator} ${index === activeHeroIndex ? styles.homeHeroIndicatorActive : ""}`}
                        aria-label={`${t("publicSite.featuredHeroItem")} ${index + 1}: ${article.title}`}
                        aria-current={index === activeHeroIndex ? "true" : undefined}
                        onClick={() => setActiveHeroIndex(index)}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    className={styles.homeHeroPauseButton}
                    aria-pressed={rotationPaused}
                    onClick={() => setRotationPaused((current) => !current)}
                  >
                    {rotationPaused ? t("publicSite.featuredHeroResume") : t("publicSite.featuredHeroPause")}
                  </button>
                </div>
              ) : null}
            </article>
          </div>
        </section>
      ) : null}

      <section className={styles.homeEditorialSection} aria-labelledby="latest-articles-title">
        <div className={styles.homeSectionHeader}>
          <div className={styles.sectionHeading}>
            <p className={styles.eyebrow}>{t("publicSite.editorialEyebrow")}</p>
            <h2 id="latest-articles-title">{t("publicSite.editorialTitle")}</h2>
            <p>{t("publicSite.editorialIntro")}</p>
          </div>
          <Link href="/articles" className={styles.homeSectionLink}>
            {t("publicSite.readLatestGuides")} <span aria-hidden="true">↗</span>
          </Link>
        </div>
        <div className={styles.articleFeaturedGrid}>
          {latestArticles.map((article) => (
            <article key={article.slug} className={styles.featuredArticleCard} lang={article.language}>
              {article.featuredImageUrl ? (
                <Link href={article.path} className={styles.articleMediaLink} aria-label={article.title}>
                  <img
                    src={article.featuredImageUrl}
                    alt={article.title}
                    width="1000"
                    height="562"
                    className={styles.articleLatestImage}
                    loading="lazy"
                    decoding="async"
                  />
                </Link>
              ) : null}
              <p className={styles.articleMeta}>
                <span>{article.readingMinutes} {t("publicSite.readingMinutes")}</span>
              </p>
              <h3>
                <Link href={article.path} className={styles.articleTitleLink}>
                  {article.title}
                </Link>
              </h3>
              <p>{article.excerpt}</p>
              <Link href={article.path} className={styles.homeArticleLink}>
                {t("publicSite.readArticle")} <span aria-hidden="true">→</span>
              </Link>
            </article>
          ))}
        </div>
        <div className={styles.homeAllArticlesAction}>
          <Link href="/articles" className={styles.primaryLink}>
            {t("publicSite.viewAllArticles")} <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>

    </main>
  );
}
