export function normalizeStreamUrl(value) {
  let raw = String(value || "").trim();
  if (!raw) return "";

  // Some providers accidentally append site URL after "?" (e.g. ...m3u8?https://site).
  // This creates a broken manifest URL in browsers.
  raw = raw.replace(/\s+/g, "");

  if (!/^https?:\/\//i.test(raw)) return raw;

  try {
    const url = new URL(raw);
    if (/^\?(https?:\/\/|www\.)/i.test(url.search || "")) {
      url.search = "";
    }
    let out = url.toString();
    out = out.replace(/[?&]+$/g, "");
    return out;
  } catch {
    return raw.replace(/\?(https?:\/\/|www\.).*$/i, "").replace(/[?&]+$/g, "");
  }
}

export function isPrivateNetworkUrl(url) {
  try {
    const host = new URL(String(url || "")).hostname;
    if (!host) return false;
    if (host === "localhost" || host === "127.0.0.1") return true;
    if (/^10\.\d+\.\d+\.\d+$/.test(host)) return true;
    if (/^192\.168\.\d+\.\d+$/.test(host)) return true;
    if (/^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/.test(host)) return true;
    return false;
  } catch {
    return false;
  }
}

export function toStreamProxyUrl(value) {
  const normalized = normalizeStreamUrl(value);
  if (!normalized) return "";
  return `/api/stream-proxy?url=${encodeURIComponent(normalized)}`;
}

export function resolveBrowserPlaybackUrl(value, protocol = "") {
  const normalized = normalizeStreamUrl(value);
  if (!normalized) return "";
  const isHttpsPage = String(protocol || "").toLowerCase() === "https:";
  const isHttpSource = /^http:\/\//i.test(normalized);
  const isPrivateSource = isPrivateNetworkUrl(normalized);
  if (isHttpsPage && isHttpSource && !isPrivateSource) {
    return toStreamProxyUrl(normalized) || normalized;
  }
  return normalized;
}
