function normalizeText(value) {
  return String(value || "").trim();
}

export function slugifyChannelName(name) {
  const normalized = normalizeText(name)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "channel";
}

export function parseChannelParam(param) {
  const raw = normalizeText(param);
  const match = raw.match(/^(\d+)(?:-(.+))?$/);
  if (!match) {
    return { id: null, slug: "" };
  }
  return {
    id: Number(match[1]),
    slug: normalizeText(match[2] || ""),
  };
}

export function buildChannelParam(channel) {
  const id = Number(channel?.id);
  if (!Number.isFinite(id) || id <= 0) return "";
  return `${id}-${slugifyChannelName(channel?.name)}`;
}

export function buildWatchPath(channel) {
  const param = buildChannelParam(channel);
  return param ? `/watch/${param}` : "/watch";
}
