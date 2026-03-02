function isIpHost(hostname) {
  return /^[\d.]+$/.test(hostname) || hostname.includes(":");
}

export function getSessionCookieDomain() {
  const explicit = String(process.env.SESSION_COOKIE_DOMAIN || "").trim().toLowerCase();
  if (explicit) {
    return explicit.replace(/^\./, "");
  }

  const candidate = String(
    process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || ""
  ).trim();
  if (!candidate) return undefined;

  try {
    const url = new URL(candidate.startsWith("http") ? candidate : `https://${candidate}`);
    const host = url.hostname.toLowerCase();
    if (!host || host === "localhost" || isIpHost(host)) return undefined;
    return host.startsWith("www.") ? host.slice(4) : host;
  } catch {
    return undefined;
  }
}

