import { NextResponse } from "next/server";
import { getCurrentAdmin } from "../../../../lib/auth";
import { normalizeStreamUrl } from "../../../../lib/streamUrl";

export const dynamic = "force-dynamic";

function isLikelyPlaylist(url, contentType) {
  const rawUrl = String(url || "").toLowerCase();
  const rawType = String(contentType || "").toLowerCase();
  return (
    /\.m3u8(\?|$)/i.test(rawUrl) ||
    rawType.includes("application/vnd.apple.mpegurl") ||
    rawType.includes("application/x-mpegurl") ||
    rawType.includes("audio/mpegurl")
  );
}

function isRiskyContainer(url) {
  return /\.(mkv|avi|flv|ts)(\?|$)/i.test(String(url || "").toLowerCase());
}

function looksLikeHtml(contentType) {
  return /text\/html|application\/xhtml\+xml/i.test(String(contentType || ""));
}

function buildVerdict({ normalizedUrl, finalUrl, status, contentType, supportsRanges }) {
  const reasons = [];
  let verdict = "ok";

  const isHttps = /^https:\/\//i.test(normalizedUrl);
  if (!isHttps) {
    verdict = "fail";
    reasons.push("Source is not HTTPS. Live HTTPS site will require proxy/transcode.");
  }

  if (!status || status < 200 || status >= 300) {
    verdict = "fail";
    reasons.push(`Source fetch failed with HTTP ${status || "unknown"}.`);
  }

  if (looksLikeHtml(contentType)) {
    verdict = "fail";
    reasons.push("Source returned HTML instead of media.");
  }

  if (!supportsRanges && !isLikelyPlaylist(finalUrl || normalizedUrl, contentType)) {
    if (verdict !== "fail") verdict = "warning";
    reasons.push("Byte-range support was not detected. Seeking may fail.");
  }

  if (isRiskyContainer(finalUrl || normalizedUrl)) {
    if (verdict !== "fail") verdict = "warning";
    reasons.push("Container is MKV/AVI/FLV/TS. Browser playback may require compatibility mode.");
  }

  const summary =
    verdict === "ok"
      ? "Looks suitable for live site playback."
      : verdict === "warning"
        ? "Playable risk detected. Save is possible, but live playback may be unreliable."
        : "Not suitable for reliable live playback.";

  return { verdict, reasons, summary };
}

export async function POST(request) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json().catch(() => ({}));
  const normalizedUrl = normalizeStreamUrl(payload?.url || "");
  if (!normalizedUrl) {
    return NextResponse.json({ error: "Missing source URL." }, { status: 400 });
  }

  let parsed;
  try {
    parsed = new URL(normalizedUrl);
  } catch {
    return NextResponse.json({ error: "Invalid source URL." }, { status: 400 });
  }

  if (!/^https?:$/i.test(parsed.protocol)) {
    return NextResponse.json({ error: "Only HTTP/HTTPS source URLs are allowed." }, { status: 400 });
  }

  const headers = new Headers();
  headers.set("user-agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari");
  headers.set("accept", "*/*");
  headers.set("range", "bytes=0-1");

  let upstream;
  try {
    upstream = await fetch(normalizedUrl, {
      method: "GET",
      headers,
      redirect: "follow",
      cache: "no-store",
    });
  } catch (error) {
    return NextResponse.json({
      normalized_url: normalizedUrl,
      final_url: "",
      verdict: "fail",
      summary: "Server could not fetch this source.",
      reasons: [String(error?.message || "Unknown fetch failure")],
      checks: {
        status_code: 0,
        content_type: "",
        supports_ranges: false,
        final_protocol: parsed.protocol.replace(":", ""),
      },
    });
  }

  const finalUrl = String(upstream.url || normalizedUrl);
  const status = Number(upstream.status || 0);
  const contentType = String(upstream.headers.get("content-type") || "");
  const acceptRanges = String(upstream.headers.get("accept-ranges") || "");
  const contentRange = String(upstream.headers.get("content-range") || "");
  const supportsRanges =
    status === 206 ||
    /\bbytes\b/i.test(acceptRanges) ||
    /^bytes\s+\d+-\d+\/\d+$/i.test(contentRange);

  const { verdict, reasons, summary } = buildVerdict({
    normalizedUrl,
    finalUrl,
    status,
    contentType,
    supportsRanges,
  });

  return NextResponse.json({
    normalized_url: normalizedUrl,
    final_url: finalUrl,
    verdict,
    summary,
    reasons,
    checks: {
      status_code: status,
      content_type: contentType,
      supports_ranges: supportsRanges,
      playlist_like: isLikelyPlaylist(finalUrl, contentType),
      risky_container: isRiskyContainer(finalUrl),
      final_protocol: (() => {
        try {
          return new URL(finalUrl).protocol.replace(":", "");
        } catch {
          return "";
        }
      })(),
    },
  });
}
