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

export function getRequestBaseUrl(request) {
  try {
    const forwardedProto = String(request?.headers?.get("x-forwarded-proto") || "").trim();
    const forwardedHost = String(request?.headers?.get("x-forwarded-host") || "").trim();
    const host = String(request?.headers?.get("host") || "").trim();
    const resolvedHost = forwardedHost || host;
    if (!resolvedHost) return getBaseUrl();
    const protocol =
      forwardedProto ||
      (resolvedHost.includes("localhost") || resolvedHost.startsWith("127.0.0.1") ? "http" : "https");
    return `${protocol}://${resolvedHost}`.replace(/\/+$/, "");
  } catch {
    return getBaseUrl();
  }
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
