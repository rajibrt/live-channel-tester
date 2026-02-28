import { createHash, randomUUID } from "crypto";

function clean(value, max = 240) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

export function buildClientMetaFromRequest(request) {
  const headers = request?.headers;
  const userAgent = clean(headers?.get("user-agent"), 512);
  const acceptLanguage = clean(headers?.get("accept-language"), 128);
  const platform = clean(headers?.get("sec-ch-ua-platform"), 64).replace(/^"|"$/g, "");
  const mobileHint = clean(headers?.get("sec-ch-ua-mobile"), 12);

  const basis = [userAgent, acceptLanguage, platform, mobileHint].join("|");
  let deviceKey = "";
  if (basis) {
    deviceKey = createHash("sha256").update(basis).digest("hex").slice(0, 24);
  } else {
    deviceKey = randomUUID().replace(/-/g, "").slice(0, 24);
  }

  return {
    device_key: deviceKey,
    user_agent: userAgent,
    accept_language: acceptLanguage,
    device_platform: platform,
    is_mobile_hint: mobileHint === "?1" || mobileHint === "1",
  };
}

