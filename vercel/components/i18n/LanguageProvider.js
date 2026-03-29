"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, dictionaries } from "../../lib/i18n/dictionaries";

const PUBLIC_LOCALE_COOKIE = "site_lang";
const DASHBOARD_LOCALE_COOKIE = "dashboard_lang";

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

function getCookieNameForPath(pathname) {
  const path = String(pathname || "");
  return path.startsWith("/dashboard") ? DASHBOARD_LOCALE_COOKIE : PUBLIC_LOCALE_COOKIE;
}

function readLocaleCookie(name) {
  if (typeof document === "undefined") return "";
  const entries = String(document.cookie || "").split(";");
  for (const entry of entries) {
    const [rawKey, ...rest] = entry.split("=");
    if (String(rawKey || "").trim() !== name) continue;
    return normalizeLocale(decodeURIComponent(rest.join("=") || ""));
  }
  return "";
}

export function LanguageProvider({ initialLocale = DEFAULT_LOCALE, children }) {
  const pathname = usePathname();
  const [locale, setLocaleState] = useState(normalizeLocale(initialLocale));

  useEffect(() => {
    const cookieName = getCookieNameForPath(pathname);
    const scopedLocale = readLocaleCookie(cookieName);
    setLocaleState(scopedLocale || DEFAULT_LOCALE);
  }, [pathname]);

  function setLocale(nextLocale) {
    const normalized = normalizeLocale(nextLocale);
    setLocaleState(normalized);
    const cookieName = getCookieNameForPath(pathname);
    document.cookie = `${cookieName}=${normalized}; path=/; max-age=31536000; samesite=lax`;
    if (cookieName === PUBLIC_LOCALE_COOKIE) {
      document.cookie = `lang=${normalized}; path=/; max-age=31536000; samesite=lax`;
    }
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
