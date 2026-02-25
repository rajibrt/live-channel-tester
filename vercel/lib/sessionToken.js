import crypto from "crypto";

const DEFAULT_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

function getSecret() {
  const secret =
    process.env.SESSION_COOKIE_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "";
  return String(secret);
}

function b64urlEncode(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function b64urlDecode(input) {
  const raw = String(input || "").replace(/-/g, "+").replace(/_/g, "/");
  const pad = raw.length % 4 ? "=".repeat(4 - (raw.length % 4)) : "";
  return Buffer.from(raw + pad, "base64").toString("utf8");
}

function signPart(part, secret) {
  return b64urlEncode(crypto.createHmac("sha256", secret).update(part).digest());
}

export function createSessionToken(payload, ttlSeconds = DEFAULT_TTL_SECONDS) {
  const secret = getSecret();
  if (!secret) throw new Error("SESSION_COOKIE_SECRET (or fallback secret) is required.");
  const exp = Math.floor(Date.now() / 1000) + Number(ttlSeconds || DEFAULT_TTL_SECONDS);
  const body = b64urlEncode(JSON.stringify({ ...payload, exp }));
  const sig = signPart(body, secret);
  return `${body}.${sig}`;
}

export function verifySessionToken(token) {
  const secret = getSecret();
  if (!secret) return null;
  const [body, sig] = String(token || "").split(".");
  if (!body || !sig) return null;
  const expected = signPart(body, secret);
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return null;
  try {
    const payload = JSON.parse(b64urlDecode(body));
    const exp = Number(payload?.exp || 0);
    if (!exp || exp <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export const SESSION_MAX_AGE = DEFAULT_TTL_SECONDS;
