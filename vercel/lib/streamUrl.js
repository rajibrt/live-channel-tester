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
