"use client";

import Image from "next/image";
import Link from "next/link";
import { useI18n } from "../i18n/LanguageProvider";
import styles from "./public-pages.module.css";

export default function PublicHomePage({ featuredArticles = [] }) {
  const { t } = useI18n();
  const latestArticles = featuredArticles.slice(0, 6);

  return (
    <main className={styles.landingShell}>
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
