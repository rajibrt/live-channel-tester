"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useI18n } from "../i18n/LanguageProvider";
import PublicLocaleToggle from "./PublicLocaleToggle";
import styles from "./public-pages.module.css";

const HIDDEN_PREFIXES = ["/dashboard", "/login", "/client-login", "/client-signup", "/client-reset-password", "/admin-reset-password"];

export default function PublicSiteHeader({ viewerEntryHref = "/client-login" }) {
  const pathname = usePathname();
  const path = String(pathname || "");
  const [menuOpen, setMenuOpen] = useState(false);
  const { t } = useI18n();
  const navLinks = [
    { href: "/", label: t("publicSite.navHome") },
    { href: "/articles", label: t("publicSite.navArticles") },
    { href: "/about", label: t("publicSite.navAbout") },
    { href: "/contact", label: t("publicSite.navContact") },
    { href: "/terms", label: t("publicSite.navTerms") },
  ];

  useEffect(() => {
    setMenuOpen(false);
  }, [path]);

  if (HIDDEN_PREFIXES.some((prefix) => path.startsWith(prefix))) {
    return null;
  }

  const isActiveLink = (href) => {
    if (href === "/") {
      return path === "/";
    }

    return path === href || path.startsWith(`${href}/`);
  };

  return (
    <header className={styles.siteHeader}>
      <div className={styles.siteHeaderInner}>
        <div className={styles.siteHeaderTopRow}>
          <Link href="/" className={styles.siteBrand} aria-label="WEBTVBD home">
            <Image src="/logo.png" alt="WEBTVBD" width={156} height={49} className={styles.siteBrandLogo} priority />
          </Link>
          <div className={styles.headerTicker} role="note" aria-label="Viewer access notice">
            <span>{t("publicSite.tickerText")}</span>
          </div>
          <Link href={viewerEntryHref} className={styles.mobileTopLoginLink}>
            {t("publicSite.clientLogin")}
          </Link>
          <button
            type="button"
            className={styles.mobileMenuButton}
            aria-expanded={menuOpen}
            aria-controls="public-site-drawer"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span />
            <span />
            <span />
          </button>
          <div className={`${styles.siteHeaderActions} ${menuOpen ? styles.siteHeaderActionsOpen : ""}`} id="public-site-drawer">
            <nav className={styles.siteHeaderNav} aria-label="Public navigation">
              {navLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={isActiveLink(item.href) ? styles.siteHeaderNavActive : undefined}
                  aria-current={isActiveLink(item.href) ? "page" : undefined}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <PublicLocaleToggle className={styles.headerLocaleButton} />
            <Link href={viewerEntryHref} className={styles.headerLoginLink}>
              {t("publicSite.clientLogin")}
            </Link>
            <div className={styles.mobileHeaderNotice}>
              <span className={styles.mobileHeaderNoticeLabel}>{t("publicSite.mobileNoticeLabel")}</span>
              <strong>{t("publicSite.tickerText")}</strong>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
