"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useI18n } from "../i18n/LanguageProvider";
import styles from "./public-pages.module.css";

export default function PublicHomePage({ featuredArticles = [] }) {
  const { t } = useI18n();
  const heroArticles = featuredArticles.filter((article) => article.featuredImageUrl).slice(0, 5);
  const latestArticles = featuredArticles.slice(0, 6);
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
              <h2 id="featured-article-title">{activeHeroArticle.title}</h2>
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

      <section className={styles.landingHero} aria-labelledby="home-title">
        <div className={styles.landingCopy}>
          <p className={styles.eyebrow}>{t("publicSite.homeEyebrow")}</p>
          <h1 id="home-title" className={styles.landingTitle}>{t("publicSite.homeTitle")}</h1>
          <p className={styles.landingIntro}>{t("publicSite.homeIntro")}</p>
          <div className={styles.actions}>
            <Link href="/articles" className={styles.primaryLink}>{t("publicSite.readLatestGuides")}</Link>
            <Link href="/about" className={styles.secondaryLink}>{t("publicSite.learnAbout")}</Link>
          </div>
          <ul className={styles.landingChecklist}>
            <li>{t("publicSite.highlight1")}</li>
            <li>{t("publicSite.highlight2")}</li>
            <li>{t("publicSite.highlight3")}</li>
          </ul>
          <div className={styles.loginHighlightBox}>
            <p className={styles.loginHighlightEyebrow}>{t("publicSite.accessRequirement")}</p>
            <p className={styles.loginHighlightText}>{t("publicSite.accessRequirementText")}</p>
          </div>
        </div>

        <div className={styles.heroShowcase}>
          <div className={styles.heroPanel}>
            <div className={styles.heroBrandCard}>
              <div className={styles.heroBrandRow}>
                <Image src="/logo.png" alt="WEBTVBD" width={312} height={98} className={styles.heroLogo} priority />
                <span className={styles.heroBadge}>{t("publicSite.heroBadge")}</span>
              </div>
              <p className={styles.heroBrandLead}>{t("publicSite.heroLead")}</p>
            </div>
            <div className={styles.heroStats}>
              {[1, 2, 3].map((number) => (
                <article key={number} className={styles.heroStatCard}>
                  <p>{t(`publicSite.stat${number}Label`)}</p>
                  <strong>{t(`publicSite.stat${number}Title`)}</strong>
                  <span>{t(`publicSite.stat${number}Body`)}</span>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className={styles.landingSection} aria-labelledby="home-purpose-title">
        <div className={styles.sectionHeading}>
          <p className={styles.eyebrow}>{t("publicSite.whyEyebrow")}</p>
          <h2 id="home-purpose-title">{t("publicSite.whyTitle")}</h2>
        </div>
        <div className={styles.grid}>
          {[1, 2, 3].map((number) => (
            <article key={number} className={styles.infoCard}>
              <strong>{t(`publicSite.feature${number}Title`)}</strong>
              <p>{t(`publicSite.feature${number}Body`)}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.homeEditorialSection} aria-labelledby="latest-articles-title">
        <div className={styles.sectionHeading}>
          <p className={styles.eyebrow}>{t("publicSite.editorialEyebrow")}</p>
          <h2 id="latest-articles-title">{t("publicSite.editorialTitle")}</h2>
          <p>{t("publicSite.editorialIntro")}</p>
        </div>
        <div className={styles.articleFeaturedGrid}>
          {latestArticles.map((article) => (
            <article key={article.slug} className={styles.featuredArticleCard} lang={article.language}>
              {article.featuredImageUrl ? (
                <img
                  src={article.featuredImageUrl}
                  alt={article.title}
                  width="1000"
                  height="562"
                  className={styles.articleLatestImage}
                  loading="lazy"
                  decoding="async"
                />
              ) : null}
              <p className={styles.articleMeta}>
                <span>{article.readingMinutes} {t("publicSite.readingMinutes")}</span>
              </p>
              <h3>{article.title}</h3>
              <p>{article.excerpt}</p>
              <Link href={article.path} className={styles.primaryLink}>{t("publicSite.readArticle")}</Link>
            </article>
          ))}
        </div>
        <div className={styles.quickLinks}>
          <Link href="/articles" className={styles.secondaryLink}>{t("publicSite.readLatestGuides")}</Link>
        </div>
      </section>

      <section className={styles.landingSection} aria-labelledby="trust-title">
        <div className={styles.sectionHeading}>
          <p className={styles.eyebrow}>{t("publicSite.routesEyebrow")}</p>
          <h2 id="trust-title">{t("publicSite.routesTitle")}</h2>
        </div>
        <div className={styles.grid}>
          {[1, 2, 3].map((number) => (
            <article key={number} className={styles.infoCard}>
              <strong>{t(`publicSite.trustTitle${number}`)}</strong>
              <p>{t(`publicSite.trustBody${number}`)}</p>
            </article>
          ))}
        </div>
        <nav className={styles.quickLinks} aria-label="Editorial and policy pages">
          <Link href="/editorial-policy" className={styles.secondaryLink}>{t("publicSite.editorialPolicy")}</Link>
          <Link href="/corrections-policy" className={styles.secondaryLink}>{t("publicSite.correctionsPolicy")}</Link>
          <Link href="/editorial-team" className={styles.secondaryLink}>{t("publicSite.editorialTeam")}</Link>
          <Link href="/contact" className={styles.secondaryLink}>{t("publicSite.navContact")}</Link>
        </nav>
      </section>
    </main>
  );
}
