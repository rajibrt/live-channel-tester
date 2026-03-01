"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, dictionaries } from "../../lib/i18n/dictionaries";

const I18nContext = createContext({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  t: (key) => key,
});

function normalizeLocale(value) {
  const next = String(value || "").trim().toLowerCase();
  return SUPPORTED_LOCALES.includes(next) ? next : DEFAULT_LOCALE;
}

function getByPath(target, path) {
  const parts = String(path || "").split(".");
  let current = target;
  for (const part of parts) {
    if (!current || typeof current !== "object" || !(part in current)) return "";
    current = current[part];
  }
  return typeof current === "string" ? current : "";
}

export function LanguageProvider({ initialLocale = DEFAULT_LOCALE, children }) {
  const [locale, setLocaleState] = useState(normalizeLocale(initialLocale));

  function setLocale(nextLocale) {
    const normalized = normalizeLocale(nextLocale);
    setLocaleState(normalized);
    document.cookie = `lang=${normalized}; path=/; max-age=31536000; samesite=lax`;
  }

  const value = useMemo(() => {
    return {
      locale,
      setLocale,
      t: (key) => {
        const active = dictionaries[locale] || dictionaries[DEFAULT_LOCALE];
        const fallback = dictionaries[DEFAULT_LOCALE];
        return getByPath(active, key) || getByPath(fallback, key) || key;
      },
    };
  }, [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
