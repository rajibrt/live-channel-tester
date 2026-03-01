function normalizeBase(raw) {
  const value = String(raw || "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value.replace(/\/+$/, "");
  return `https://${value.replace(/\/+$/, "")}`;
}

export function getBaseUrl() {
  const fromEnv =
    normalizeBase(process.env.NEXT_PUBLIC_SITE_URL) ||
    normalizeBase(process.env.SITE_URL) ||
    normalizeBase(process.env.VERCEL_PROJECT_PRODUCTION_URL);

  return fromEnv || "https://webtvbd.com";
}

export function toAbsoluteUrl(pathOrUrl) {
  const value = String(pathOrUrl || "").trim();
  if (!value) return "";
  try {
    return new URL(value, getBaseUrl()).toString();
  } catch {
    return "";
  }
}
