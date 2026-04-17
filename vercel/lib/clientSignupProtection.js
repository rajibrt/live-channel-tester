import { createHash } from "crypto";

const FALLBACK_BUCKETS = new Map();
const RATE_LIMITS = {
  ipTenMinutes: 5,
  ipDay: 12,
  deviceThirtyMinutes: 3,
  deviceDay: 8,
};
const APPROVAL_QUEUE_LIMITS = {
  sameDeviceAndIpDay: 1,
  ipDay: 3,
};

function clean(value, max = 240) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function hashValue(value) {
  const normalized = clean(value, 512).toLowerCase();
  if (!normalized) return "";
  return createHash("sha256").update(normalized).digest("hex");
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function subtractMinutes(date, minutes) {
  return new Date(date.getTime() - minutes * 60 * 1000).toISOString();
}

function isMissingTableError(error) {
  const code = String(error?.code || "");
  const message = String(error?.message || "").toLowerCase();
  return code === "42P01" || message.includes("signup_security_events");
}

function pickFirstForwarded(value) {
  return clean(String(value || "").split(",")[0], 120);
}

export function buildSignupSecurityMeta(request, requestMeta = {}) {
  const headers = request?.headers;
  const ip =
    pickFirstForwarded(headers?.get("cf-connecting-ip")) ||
    pickFirstForwarded(headers?.get("x-forwarded-for")) ||
    pickFirstForwarded(headers?.get("x-real-ip")) ||
    pickFirstForwarded(headers?.get("x-vercel-forwarded-for"));
  const deviceBasis = [
    requestMeta?.device_key,
    requestMeta?.user_agent,
    requestMeta?.accept_language,
    requestMeta?.device_platform,
  ]
    .filter(Boolean)
    .join("|");

  return {
    ip_hash: hashValue(ip),
    device_hash: hashValue(deviceBasis),
    user_agent: clean(requestMeta?.user_agent, 512),
    accept_language: clean(requestMeta?.accept_language, 128),
    device_platform: clean(requestMeta?.device_platform, 64),
  };
}

export function isTurnstileConfigured() {
  return Boolean(String(process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY || "").trim());
}

export async function verifyTurnstileToken({ token, remoteIp = "" }) {
  const secret = String(process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY || "").trim();
  const required = String(process.env.TURNSTILE_REQUIRED || "").trim().toLowerCase() === "true";
  if (!secret) return { ok: !required, skipped: !required, errorCode: required ? "missing_secret" : "" };

  const body = new URLSearchParams();
  body.set("secret", secret);
  body.set("response", String(token || "").trim());
  if (remoteIp) body.set("remoteip", remoteIp);

  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
      headers: { "content-type": "application/x-www-form-urlencoded" },
      cache: "no-store",
    });
    const result = await response.json().catch(() => ({}));
    return {
      ok: Boolean(response.ok && result?.success),
      skipped: false,
      errorCode: Array.isArray(result?.["error-codes"]) ? result["error-codes"].join(",") : "",
    };
  } catch {
    return { ok: false, skipped: false, errorCode: "verify_failed" };
  }
}

async function countRows(query) {
  const { count, error } = await query;
  if (error) throw error;
  return Number(count || 0);
}

async function countRecentSignupEvents(admin, meta, now) {
  const ipHash = String(meta?.ip_hash || "");
  const deviceHash = String(meta?.device_hash || "");
  const baseSelect = "id";
  const queries = [];

  if (ipHash) {
    queries.push(
      countRows(
        admin
          .from("signup_security_events")
          .select(baseSelect, { count: "exact", head: true })
          .eq("ip_hash", ipHash)
          .gte("created_at", subtractMinutes(now, 10))
      ),
      countRows(
        admin
          .from("signup_security_events")
          .select(baseSelect, { count: "exact", head: true })
          .eq("ip_hash", ipHash)
          .gte("created_at", subtractMinutes(now, 1440))
      )
    );
  } else {
    queries.push(Promise.resolve(0), Promise.resolve(0));
  }

  if (deviceHash) {
    queries.push(
      countRows(
        admin
          .from("signup_security_events")
          .select(baseSelect, { count: "exact", head: true })
          .eq("device_hash", deviceHash)
          .gte("created_at", subtractMinutes(now, 30))
      ),
      countRows(
        admin
          .from("signup_security_events")
          .select(baseSelect, { count: "exact", head: true })
          .eq("device_hash", deviceHash)
          .gte("created_at", subtractMinutes(now, 1440))
      )
    );
  } else {
    queries.push(Promise.resolve(0), Promise.resolve(0));
  }

  const [ipTenMinutes, ipDay, deviceThirtyMinutes, deviceDay] = await Promise.all(queries);
  return { ipTenMinutes, ipDay, deviceThirtyMinutes, deviceDay };
}

function fallbackRateLimit(meta, now) {
  const key = String(meta?.ip_hash || meta?.device_hash || "unknown");
  const existing = FALLBACK_BUCKETS.get(key) || [];
  const live = existing.filter((ts) => ts > addMinutes(now, -1440).getTime());
  const tenMinuteCount = live.filter((ts) => ts > addMinutes(now, -10).getTime()).length;
  const dayCount = live.length;
  live.push(now.getTime());
  FALLBACK_BUCKETS.set(key, live);

  if (FALLBACK_BUCKETS.size > 1000) {
    for (const [bucketKey, timestamps] of FALLBACK_BUCKETS) {
      const next = timestamps.filter((ts) => ts > addMinutes(now, -1440).getTime());
      if (next.length) FALLBACK_BUCKETS.set(bucketKey, next);
      else FALLBACK_BUCKETS.delete(bucketKey);
    }
  }

  return {
    ok: tenMinuteCount < RATE_LIMITS.ipTenMinutes && dayCount < RATE_LIMITS.ipDay,
    counts: {
      ipTenMinutes: tenMinuteCount,
      ipDay: dayCount,
      deviceThirtyMinutes: 0,
      deviceDay: 0,
    },
    fallback: true,
  };
}

export async function checkSignupRateLimit(admin, meta) {
  const now = new Date();
  try {
    const counts = await countRecentSignupEvents(admin, meta, now);
    const blocked =
      counts.ipTenMinutes >= RATE_LIMITS.ipTenMinutes ||
      counts.ipDay >= RATE_LIMITS.ipDay ||
      counts.deviceThirtyMinutes >= RATE_LIMITS.deviceThirtyMinutes ||
      counts.deviceDay >= RATE_LIMITS.deviceDay;

    return { ok: !blocked, counts, fallback: false };
  } catch (error) {
    if (!isMissingTableError(error)) throw error;
    return fallbackRateLimit(meta, now);
  }
}

async function countRecentSuccessfulSignupEvents(admin, meta, now) {
  const ipHash = String(meta?.ip_hash || "");
  const deviceHash = String(meta?.device_hash || "");
  const since = subtractMinutes(now, 1440);
  const queries = [];

  if (ipHash && deviceHash) {
    queries.push(
      countRows(
        admin
          .from("signup_security_events")
          .select("id", { count: "exact", head: true })
          .eq("status", "succeeded")
          .eq("ip_hash", ipHash)
          .eq("device_hash", deviceHash)
          .gte("created_at", since)
      )
    );
  } else {
    queries.push(Promise.resolve(0));
  }

  if (ipHash) {
    queries.push(
      countRows(
        admin
          .from("signup_security_events")
          .select("id", { count: "exact", head: true })
          .eq("status", "succeeded")
          .eq("ip_hash", ipHash)
          .gte("created_at", since)
      )
    );
  } else {
    queries.push(Promise.resolve(0));
  }

  const [sameDeviceAndIpDay, ipDay] = await Promise.all(queries);
  return { sameDeviceAndIpDay, ipDay };
}

export async function checkSignupApprovalQueueLimit(admin, meta) {
  const now = new Date();
  try {
    const counts = await countRecentSuccessfulSignupEvents(admin, meta, now);
    if (counts.sameDeviceAndIpDay >= APPROVAL_QUEUE_LIMITS.sameDeviceAndIpDay) {
      return { ok: false, reason: "same_device_ip_pending", counts, fallback: false };
    }
    if (counts.ipDay >= APPROVAL_QUEUE_LIMITS.ipDay) {
      return { ok: false, reason: "ip_pending_capacity", counts, fallback: false };
    }
    return { ok: true, reason: "", counts, fallback: false };
  } catch (error) {
    if (!isMissingTableError(error)) throw error;
    return { ok: true, reason: "", counts: { sameDeviceAndIpDay: 0, ipDay: 0 }, fallback: true };
  }
}

export async function recordSignupSecurityEvent(admin, meta, event) {
  const payload = {
    ip_hash: meta?.ip_hash || "",
    device_hash: meta?.device_hash || "",
    user_agent: meta?.user_agent || "",
    accept_language: meta?.accept_language || "",
    device_platform: meta?.device_platform || "",
    email_hash: hashValue(event?.email || ""),
    mobile_hash: hashValue(event?.mobile_key || event?.mobile || ""),
    status: clean(event?.status, 32) || "unknown",
    reason: clean(event?.reason, 120),
    details_json: event?.details && typeof event.details === "object" ? event.details : {},
    created_at: new Date().toISOString(),
  };

  const { error } = await admin.from("signup_security_events").insert(payload);
  if (error && !isMissingTableError(error)) {
    console.error("signup security event insert failed", error.message || error);
  }
}
