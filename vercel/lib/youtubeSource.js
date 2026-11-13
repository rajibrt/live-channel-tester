// Official YouTube live streams as channel sources.
// Store a channel's always-on live URL as https://www.youtube.com/channel/<UC…>/live
// (the embed follows whatever video the channel is currently streaming), or a single
// video as https://www.youtube.com/watch?v=<id>. The player shows YouTube's own embed;
// we never extract the underlying stream (YouTube terms), so these links are not
// usable by IPTV apps and are left out of the M3U playlist.

const HOST_RE = /^(?:www\.|m\.)?(?:youtube\.com|youtube-nocookie\.com|youtu\.be)$/i;

export function isYouTubeUrl(url) {
  try {
    return HOST_RE.test(new URL(String(url || "")).hostname);
  } catch {
    return false;
  }
}

// Returns { kind: "channel"|"video", id } or null.
export function parseYouTubeSource(url) {
  let u;
  try {
    u = new URL(String(url || ""));
  } catch {
    return null;
  }
  if (!HOST_RE.test(u.hostname)) return null;
  const parts = u.pathname.split("/").filter(Boolean);
  if (/youtu\.be$/i.test(u.hostname)) return parts[0] ? { kind: "video", id: parts[0] } : null;
  if (parts[0] === "channel" && /^UC[\w-]{20,}$/.test(parts[1] || "")) return { kind: "channel", id: parts[1] };
  if (parts[0] === "embed" && parts[1] === "live_stream") {
    const ch = u.searchParams.get("channel");
    return ch ? { kind: "channel", id: ch } : null;
  }
  if ((parts[0] === "embed" || parts[0] === "live" || parts[0] === "shorts") && parts[1]) return { kind: "video", id: parts[1] };
  const v = u.searchParams.get("v");
  if (v) return { kind: "video", id: v };
  return null;
}

export function youTubeEmbedUrl(url, { origin = "" } = {}) {
  const parsed = parseYouTubeSource(url);
  if (!parsed) return "";
  const params = new URLSearchParams({ autoplay: "1", playsinline: "1", rel: "0", enablejsapi: "1" });
  if (origin) params.set("origin", origin);
  if (parsed.kind === "channel") {
    params.set("channel", parsed.id);
    return `https://www.youtube.com/embed/live_stream?${params.toString()}`;
  }
  return `https://www.youtube.com/embed/${encodeURIComponent(parsed.id)}?${params.toString()}`;
}
