"use client";

import { Languages } from "lucide-react";
import { useRouter } from "next/navigation";
import { useI18n } from "../i18n/LanguageProvider";
import styles from "./public-pages.module.css";

// Language switch in the Camera Bazar style: a translate icon plus the name of the other
// language ("বাংলা" while English is shown, "English" while Bengali is shown).
export default function PublicLocaleToggle({ className = "" }) {
  const router = useRouter();
  const { locale, setLocale, t } = useI18n();
  const target = locale === "bn" ? { code: "en", label: "English" } : { code: "bn", label: "বাংলা" };

  return (
    <button
      type="button"
      className={`${styles.localeSwitch} ${className}`}
      lang={target.code}
      aria-label={`${t("publicSite.languageLabel")}: ${target.label}`}
      title={target.label}
      onClick={() => {
        setLocale(target.code);
        router.refresh();
      }}
    >
      <Languages size={17} strokeWidth={2} aria-hidden="true" />
      <span>{target.label}</span>
    </button>
  );
}
