"use client";

import { useRouter } from "next/navigation";
import { useI18n } from "../i18n/LanguageProvider";

function nextLocale(locale) {
  return locale === "bn" ? "en" : "bn";
}

export default function PublicLocaleToggle({ className = "" }) {
  const router = useRouter();
  const { locale, setLocale, t } = useI18n();

  return (
    <button
      type="button"
      className={className}
      aria-label={`${t("publicSite.languageLabel")}: ${locale.toUpperCase()}`}
      onClick={() => {
        const selected = nextLocale(locale);
        setLocale(selected);
        router.refresh();
      }}
    >
      <span>{locale === "bn" ? "বাংলা" : "EN"}</span>
    </button>
  );
}
