"use client";

import Image from "next/image";
import Link from "next/link";
import { useI18n } from "../i18n/LanguageProvider";
import styles from "./public-pages.module.css";

export default function PublicHomePage({ featuredArticles = [] }) {
  const { t } = useI18n();

  return (
    <main className={styles.landingShell}>
      <section className={styles.landingHero}>
        <div className={styles.landingCopy}>
          <p className={styles.eyebrow}>{t("publicSite.homeEyebrow")}</p>
          <h1 className={styles.landingTitle}>{t("publicSite.homeTitle")}</h1>
          <p className={styles.landingIntro}>{t("publicSite.homeIntro")}</p>
          <div className={styles.actions}>
            <Link href="/client-login" className={styles.primaryLink}>
              {t("publicSite.clientLogin")}
            </Link>
            <Link href="/about" className={styles.secondaryLink}>
              {t("publicSite.learnAbout")}
            </Link>
          </div>
        </div>

        <section className={styles.heroShowcase}>
          <div className={styles.heroPanel}>
            <div className={styles.heroBrandCard}>
              <div className={styles.heroBrandRow}>
                <Image src="/logo.png" alt="WEBTVBD" width={176} height={55} className={styles.heroLogo} priority />
                <span className={styles.heroBadge}>{t("publicSite.heroBadge")}</span>
              </div>
              <p className={styles.heroBrandLead}>{t("publicSite.heroLead")}</p>
            </div>
            <div className={styles.heroStats}>
              <article className={styles.heroStatCard}>
                <p>{t("publicSite.stat1Label")}</p>
                <strong>{t("publicSite.stat1Title")}</strong>
                <span>{t("publicSite.stat1Body")}</span>
              </article>
              <article className={styles.heroStatCard}>
                <p>{t("publicSite.stat2Label")}</p>
                <strong>{t("publicSite.stat2Title")}</strong>
                <span>{t("publicSite.stat2Body")}</span>
              </article>
              <article className={styles.heroStatCard}>
                <p>{t("publicSite.stat3Label")}</p>
                <strong>{t("publicSite.stat3Title")}</strong>
                <span>{t("publicSite.stat3Body")}</span>
              </article>
            </div>
          </div>
        </section>
      </section>

      <section className={styles.noticeBox}>
        <p className={styles.noticeTitle}>{t("publicSite.sourceNoticeTitle")}</p>
        <p className={styles.noticeText}>{t("publicSite.sourceNoticeBody")}</p>
      </section>

      <section className={styles.homeEditorialSection}>
        <div className={styles.sectionHeading}>
          <p className={styles.eyebrow}>{t("publicSite.editorialEyebrow")}</p>
          <h2>{t("publicSite.editorialTitle")}</h2>
          <p>{t("publicSite.editorialIntro")}</p>
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

      <section className={styles.homeTrustGrid}>
        <article className={styles.infoCard}>
          <strong>{t("publicSite.trustTitle1")}</strong>
          <p>{t("publicSite.trustBody1")}</p>
        </article>
        <article className={styles.infoCard}>
          <strong>{t("publicSite.trustTitle2")}</strong>
          <p>{t("publicSite.trustBody2")}</p>
        </article>
        <article className={styles.infoCard}>
          <strong>{t("publicSite.trustTitle3")}</strong>
          <p>{t("publicSite.trustBody3")}</p>
        </article>
      </section>
    </main>
  );
}
