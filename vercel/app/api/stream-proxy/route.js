import { NextResponse } from "next/server";
import { requireClientApi } from "../../../lib/clientApi";
import { normalizeStreamUrl, toStreamProxyUrl } from "../../../lib/streamUrl";

export const dynamic = "force-dynamic";

function hasHlsContentType(value) {
  const v = String(value || "").toLowerCase();
  return (
    v.includes("application/vnd.apple.mpegurl") ||
    v.includes("application/x-mpegurl") ||
    v.includes("audio/mpegurl")
  );
}

function isLikelyM3u8Url(value) {
  return /\.m3u8(\?|$)/i.test(String(value || ""));
}

function rewriteTagUris(line, baseUrl) {
  // Rewrites URI="<relative-or-absolute>" inside HLS tags.
  return line.replace(/URI="([^"]+)"/g, (_full, uriValue) => {
    const next = String(uriValue || "").trim();
    if (!next) return 'URI=""';
    try {
      const resolved = new URL(next, baseUrl).toString();
      return `URI="${toStreamProxyUrl(resolved)}"`;
    } catch {
      return `URI="${uriValue}"`;
    }
  });
}

function rewriteManifest(manifestText, finalUrl) {
  const lines = String(manifestText || "").split(/\r?\n/);
  const out = [];

  for (const rawLine of lines) {
    const line = String(rawLine || "");
    const trimmed = line.trim();
    if (!trimmed) {
      out.push(line);
      continue;
    }
    if (trimmed.startsWith("#")) {
      out.push(rewriteTagUris(line, finalUrl));
      continue;
    }
    try {
      const resolved = new URL(trimmed, finalUrl).toString();
      out.push(toStreamProxyUrl(resolved));
    } catch {
      out.push(line);
    }
  }

  return out.join("\n");
}

export async function GET(request) {
  const auth = await requireClientApi();
  if (!auth.ok) return auth.response;

  const urlValue = request.nextUrl.searchParams.get("url") || "";
  const target = normalizeStreamUrl(urlValue);
  if (!target) {
    return NextResponse.json({ error: "Missing url query parameter." }, { status: 400 });
  }

  let parsed = null;
  try {
    parsed = new URL(target);
  } catch {
    return NextResponse.json({ error: "Invalid target URL." }, { status: 400 });
  }
  if (!/^https?:$/i.test(parsed.protocol)) {
    return NextResponse.json({ error: "Only HTTP/HTTPS URLs are allowed." }, { status: 400 });
  }

  const reqHeaders = new Headers();
  const range = request.headers.get("range");
  if (range) reqHeaders.set("range", range);
  reqHeaders.set(
    "user-agent",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari"
  );
  reqHeaders.set("accept", "*/*");

  let upstream = null;
  try {
    upstream = await fetch(target, {
      method: "GET",
      headers: reqHeaders,
      redirect: "follow",
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch target stream." }, { status: 502 });
  }

  if (!upstream.ok) {
    return NextResponse.json(
      { error: `Upstream responded with HTTP ${upstream.status}.` },
      { status: 502 }
    );
  }

  const finalUrl = upstream.url || target;
  const contentType = upstream.headers.get("content-type") || "";
  const asManifest = hasHlsContentType(contentType) || isLikelyM3u8Url(finalUrl);

  if (asManifest) {
    const text = await upstream.text();
    const rewritten = rewriteManifest(text, finalUrl);
    return new NextResponse(rewritten, {
      status: 200,
      headers: {
        "content-type": "application/vnd.apple.mpegurl; charset=utf-8",
        "cache-control": "no-store, no-cache, must-revalidate",
      },
    });
  }

  const passthroughHeaders = new Headers();
  const passType = upstream.headers.get("content-type");
  const passLength = upstream.headers.get("content-length");
  const passRanges = upstream.headers.get("accept-ranges");
  const passRange = upstream.headers.get("content-range");
  if (passType) passthroughHeaders.set("content-type", passType);
  if (passLength) passthroughHeaders.set("content-length", passLength);
  if (passRanges) passthroughHeaders.set("accept-ranges", passRanges);
  if (passRange) passthroughHeaders.set("content-range", passRange);
  passthroughHeaders.set("cache-control", "no-store, no-cache, must-revalidate");

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: passthroughHeaders,
  });
}
