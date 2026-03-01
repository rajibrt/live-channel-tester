"use client";

import styles from "../page.module.css";
import ManageAdminUsers from "./ManageAdminUsers";
import ManageEmailSettings from "./ManageEmailSettings";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useI18n } from "../../../components/i18n/LanguageProvider";

function normalizeTab(value) {
  const tab = String(value || "").trim().toLowerCase();
  return tab === "email" ? "email" : "admins";
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
      </div>
      {activeTab === "admins" ? <ManageAdminUsers /> : <ManageEmailSettings />}
    </section>
  );
}
