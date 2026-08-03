"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "../i18n/LanguageProvider";
import styles from "./public-pages.module.css";

const HIDDEN_PREFIXES = ["/dashboard", "/login", "/client-login", "/client-signup", "/client-reset-password", "/admin-reset-password"];

export default function PublicSiteFooter() {
  const pathname = usePathname();
  const path = String(pathname || "");
  const { t } = useI18n();
  const footerLinks = [
    { href: "/articles", label: t("publicSite.navArticles") },
    { href: "/about", label: t("publicSite.navAbout") },
    { href: "/contact", label: t("publicSite.navContact") },
    { href: "/privacy-policy", label: t("publicSite.privacyPolicy") },
    { href: "/cookie-policy", label: t("publicSite.cookiePolicy") },
    { href: "/terms", label: t("publicSite.navTerms") },
    { href: "/dmca", label: t("publicSite.dmca") },
    { href: "/editorial-policy", label: t("publicSite.editorialPolicy") },
    { href: "/corrections-policy", label: t("publicSite.correctionsPolicy") },
    { href: "/advertising-disclosure", label: t("publicSite.advertisingDisclosure") },
    { href: "/editorial-team", label: t("publicSite.editorialTeam") },
  ];
  if (HIDDEN_PREFIXES.some((prefix) => path.startsWith(prefix))) {
    return null;
  }

  return (
    <footer className={styles.footer}>
      <div className={styles.footerBrand}>
        <strong>WEBTVBD</strong>
        <span>{t("publicSite.footerDescription")}</span>
      </div>
      <nav className={styles.footerNav} aria-label="Public site links">
        {footerLinks.map((item) => (
          <Link key={item.href} href={item.href}>
            {item.label}
          </Link>
        ))}
      </nav>
    </footer>
  );
}
