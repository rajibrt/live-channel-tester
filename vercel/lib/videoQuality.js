function text(value) {
  return String(value || "").trim();
}

function classifyByHeight(height) {
  const h = Number(height);
  if (!Number.isFinite(h) || h <= 0) return "";
  if (h >= 2160) return "4K";
  if (h >= 1080) return "FULL HD";
  if (h >= 720) return "HD";
  return "SD";
}

function inferHeightFromUrl(url) {
  const value = text(url).toLowerCase();
  if (!value) return 0;
  const match = value.match(/(?:^|[^0-9])(2160|1440|1080|720|576|540|480|360|240)p?(?:[^0-9]|$)/);
  if (!match) return 0;
  return Number(match[1]) || 0;
}

export function inferVideoQualityLabelFromUrl(url) {
  return classifyByHeight(inferHeightFromUrl(url));
}

function parseM3u8MaxHeight(manifest) {
  const body = text(manifest);
  if (!body) return 0;
  let maxHeight = 0;
  const matches = body.matchAll(/RESOLUTION\s*=\s*(\d+)\s*x\s*(\d+)/gi);
  for (const match of matches) {
    const h = Number(match?.[2] || 0);
    if (Number.isFinite(h) && h > maxHeight) maxHeight = h;
  }
  return maxHeight;
}

function parseMpdMaxHeight(xmlText) {
  const body = text(xmlText);
  if (!body) return 0;
  let maxHeight = 0;
  const heightMatches = body.matchAll(/\bheight\s*=\s*["'](\d+)["']/gi);
  for (const match of heightMatches) {
    const h = Number(match?.[1] || 0);
    if (Number.isFinite(h) && h > maxHeight) maxHeight = h;
  }
  return maxHeight;
}

async function fetchWithTimeout(url, timeoutMs = 4500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "GET",
      cache: "no-store",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        Accept: "application/vnd.apple.mpegurl,application/x-mpegURL,application/dash+xml,text/plain,*/*",
      },
    });
    if (!res.ok) return null;
    return res;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function detectVideoQualityLabel(sourceUrl) {
  const url = text(sourceUrl);
  if (!url) return "";

  const byUrl = inferVideoQualityLabelFromUrl(url);
  const lower = url.toLowerCase();
  const looksLikeManifest = lower.includes(".m3u8") || lower.includes(".mpd");

  if (!looksLikeManifest) return byUrl;

  const res = await fetchWithTimeout(url);
  if (!res) return byUrl;

  const contentType = text(res.headers.get("content-type")).toLowerCase();
  const body = await res.text().catch(() => "");

  if (contentType.includes("dash") || lower.includes(".mpd")) {
    const mpdHeight = parseMpdMaxHeight(body);
    return classifyByHeight(mpdHeight) || byUrl;
  }

  const m3u8Height = parseM3u8MaxHeight(body);
  return classifyByHeight(m3u8Height) || byUrl;
}
