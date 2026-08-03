"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useI18n } from "../i18n/LanguageProvider";
import PublicLocaleToggle from "./PublicLocaleToggle";
import styles from "./public-pages.module.css";

const HIDDEN_PREFIXES = ["/dashboard", "/login", "/client-login", "/client-signup", "/client-reset-password", "/admin-reset-password"];

const SOCIAL_LINKS = [
  {
    name: "Facebook",
    href: process.env.NEXT_PUBLIC_FACEBOOK_URL || process.env.NEXT_PUBLIC_FACEBOOK_INBOX_URL || "https://www.facebook.com/WEBTVBD",
    icon: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 8h3V4h-3c-3 0-5 2-5 5v3H6v4h3v8h4v-8h3.5l.5-4h-4V9c0-.6.4-1 1-1Z" /></svg>,
  },
  {
    name: "YouTube",
    href: process.env.NEXT_PUBLIC_YOUTUBE_URL || "https://www.youtube.com/@WEBTVBD",
    icon: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8ZM9.6 15.6V8.4l6.3 3.6-6.3 3.6Z" /></svg>,
  },
  {
    name: "Instagram",
    href: process.env.NEXT_PUBLIC_INSTAGRAM_URL || "https://www.instagram.com/webtvbd",
    icon: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5Zm0 2a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7Zm10.5 1.5A1.25 1.25 0 1 1 17.5 8a1.25 1.25 0 0 1 0-2.5ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z" /></svg>,
  },
  {
    name: "X",
    href: process.env.NEXT_PUBLIC_X_URL || "https://x.com/WEBTVBD",
    icon: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.9 3H22l-6.8 7.8L23 21h-6.1l-4.8-6.3L6.6 21H3.5l7.1-8.1L3 3h6.3l4.3 5.7L18.9 3Zm-1.1 16.2h1.7L8.4 4.7H6.6l11.2 14.5Z" /></svg>,
  },
];

export default function PublicSiteHeader({ viewerEntryHref = "/client-login", homeHref = "/" }) {
  const pathname = usePathname();
  const path = String(pathname || "");
  const [menuOpen, setMenuOpen] = useState(false);
  const { t } = useI18n();
  const navLinks = [
    { href: homeHref, label: t("publicSite.navHome") },
    { href: "/articles", label: t("publicSite.navArticles") },
    { href: "/about", label: t("publicSite.navAbout") },
    { href: "/contact", label: t("publicSite.navContact") },
    { href: "/terms", label: t("publicSite.navTerms") },
  ];

  useEffect(() => {
    setMenuOpen(false);
  }, [path]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuOpen]);

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
          <Link href={homeHref} className={styles.siteBrand} aria-label="WEBTVBD home">
            <Image src="/logo.png" alt="WEBTVBD" width={156} height={49} className={styles.siteBrandLogo} priority />
          </Link>
          <Link href={viewerEntryHref} className={styles.mobileTopLoginLink}>
            {t("publicSite.clientLogin")}
          </Link>
          <button
            type="button"
            className={`${styles.mobileMenuButton} ${menuOpen ? styles.mobileMenuButtonOpen : ""}`}
            aria-expanded={menuOpen}
            aria-controls="public-site-drawer"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span />
            <span />
            <span />
          </button>
          {menuOpen ? (
            <button
              type="button"
              className={styles.drawerBackdrop}
              aria-label={t("publicSite.closeMenu")}
              onClick={() => setMenuOpen(false)}
            />
          ) : null}
          <div
            className={`${styles.siteHeaderActions} ${menuOpen ? styles.siteHeaderActionsOpen : ""}`}
            id="public-site-drawer"
            role={menuOpen ? "dialog" : undefined}
            aria-modal={menuOpen ? "true" : undefined}
            aria-label={menuOpen ? t("publicSite.mobileMenu") : undefined}
          >
            <div className={styles.mobileDrawerHeader}>
              <Link href={homeHref} className={styles.mobileDrawerBrand} aria-label="WEBTVBD home">
                <Image src="/logo.png" alt="WEBTVBD" width={156} height={49} className={styles.mobileDrawerLogo} />
              </Link>
              <button
                type="button"
                className={styles.mobileDrawerClose}
                aria-label={t("publicSite.closeMenu")}
                onClick={() => setMenuOpen(false)}
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>
            <div className={styles.mobileDrawerIntro}>
              <span>{t("publicSite.mobileMenu")}</span>
              <strong>WEBTVBD</strong>
            </div>
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
            <div className={styles.mobileDrawerUtility}>
              <PublicLocaleToggle className={styles.headerLocaleButton} />
              <Link href={viewerEntryHref} className={styles.headerLoginLink}>
                {t("publicSite.clientLogin")}
              </Link>
            </div>
            <footer className={styles.mobileDrawerFooter}>
              <span className={styles.mobileDrawerSocialLabel}>{t("publicSite.followUs")}</span>
              <div className={styles.mobileDrawerSocials}>
                {SOCIAL_LINKS.map((item) => (
                  <a key={item.name} href={item.href} target="_blank" rel="noopener noreferrer" aria-label={item.name} title={item.name}>
                    {item.icon}
                  </a>
                ))}
              </div>
              <p>{t("publicSite.footerDescription")}</p>
              <small>© {new Date().getFullYear()} WEBTVBD</small>
            </footer>
          </div>
        </div>
      </div>
    </header>
  );
}
