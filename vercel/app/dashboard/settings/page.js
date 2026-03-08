"use client";

import styles from "../page.module.css";
import ManageAdminUsers from "./ManageAdminUsers";
import ManageEmailSettings from "./ManageEmailSettings";
import ManageSiteSeoSettings from "./ManageSiteSeoSettings";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useI18n } from "../../../components/i18n/LanguageProvider";

function normalizeTab(value) {
  const tab = String(value || "").trim().toLowerCase();
  if (tab === "email") return "email";
  if (tab === "seo") return "seo";
  return "admins";
}

export default function SettingsPage() {
  const searchParams = useSearchParams();
  const { t } = useI18n();
  const activeTab = normalizeTab(searchParams?.get("tab"));

  return (
    <section className={styles.card}>
      <div className={styles.settingsTabs}>
        <Link
          href="/dashboard/settings?tab=admins"
          className={`${styles.settingsTab} ${activeTab === "admins" ? styles.settingsTabActive : ""}`}
          prefetch={false}
        >
          {t("settings.tabAdmins")}
        </Link>
        <Link
          href="/dashboard/settings?tab=email"
          className={`${styles.settingsTab} ${activeTab === "email" ? styles.settingsTabActive : ""}`}
          prefetch={false}
        >
          {t("settings.tabEmail")}
        </Link>
        <Link
          href="/dashboard/settings?tab=seo"
          className={`${styles.settingsTab} ${activeTab === "seo" ? styles.settingsTabActive : ""}`}
          prefetch={false}
        >
          {t("settings.tabSeo")}
        </Link>
      </div>
      {activeTab === "admins" ? <ManageAdminUsers /> : null}
      {activeTab === "email" ? <ManageEmailSettings /> : null}
      {activeTab === "seo" ? <ManageSiteSeoSettings /> : null}
    </section>
  );
}
