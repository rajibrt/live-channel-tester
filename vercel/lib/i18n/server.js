import { cookies } from "next/headers";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, dictionaries } from "./dictionaries";

export async function getLocaleFromRequest() {
  const cookieStore = await cookies();
  const raw = String(cookieStore.get("lang")?.value || "").trim().toLowerCase();
  return SUPPORTED_LOCALES.includes(raw) ? raw : DEFAULT_LOCALE;
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

export async function getDictionaryForRequest() {
  const locale = await getLocaleFromRequest();
  const active = dictionaries[locale] || dictionaries[DEFAULT_LOCALE];
  const fallback = dictionaries[DEFAULT_LOCALE];
  return {
    locale,
    t: (key) => getByPath(active, key) || getByPath(fallback, key) || key,
  };
}
