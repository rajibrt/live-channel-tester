import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

// Server-only guard for routes that fetch user-supplied stream URLs.
// LAN ranges (10/8, 172.16/12, 192.168/16) stay allowed on purpose: movie and
// channel sources such as 10.1.1.1 live on the ISP/local network. Loopback,
// link-local (cloud metadata), unspecified and similar addresses are blocked.

const BLOCKED_HOSTNAMES = new Set(["localhost", "metadata.google.internal", "metadata"]);

function isBlockedIPv4(ip) {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) return true;
  const [a, b] = parts;
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local / cloud metadata
  if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT / some cloud metadata
  if (a >= 224) return true; // multicast + reserved
  return false;
}

function isBlockedIPv6(ip) {
  const value = ip.toLowerCase().replace(/^\[|\]$/g, "");
  if (value === "::" || value === "::1") return true;
  if (/^fe[89ab][0-9a-f]:/.test(value)) return true; // link-local fe80::/10
  if (value.startsWith("ff")) return true; // multicast
  const mapped = value.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isBlockedIPv4(mapped[1]);
  if (value.startsWith("::ffff:")) return true; // hex-form mapped address; reject conservatively
  return false;
}

export function isBlockedAddress(address) {
  const kind = isIP(address);
  if (kind === 4) return isBlockedIPv4(address);
  if (kind === 6) return isBlockedIPv6(address);
  return true;
}

/**
 * Returns an error message when the URL must not be fetched by the server,
 * or an empty string when it is allowed.
 */
export async function getBlockedStreamTargetReason(urlValue) {
  let parsed;
  try {
    parsed = new URL(String(urlValue || ""));
  } catch {
    return "Invalid target URL.";
  }
  if (!/^https?:$/i.test(parsed.protocol)) return "Only HTTP/HTTPS URLs are allowed.";
  if (parsed.username || parsed.password) return "Credentials in stream URLs are not allowed.";

  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (!host) return "Invalid target URL.";
  if (BLOCKED_HOSTNAMES.has(host) || host.endsWith(".localhost") || host.endsWith(".internal")) {
    return "This target host is not allowed.";
  }

  if (isIP(host)) {
    return isBlockedAddress(host) ? "This target address is not allowed." : "";
  }

  let addresses = [];
  try {
    addresses = await lookup(host, { all: true, verbatim: true });
  } catch {
    return "Target host could not be resolved.";
  }
  if (!addresses.length) return "Target host could not be resolved.";
  if (addresses.some((entry) => isBlockedAddress(entry.address))) {
    return "This target address is not allowed.";
  }
  return "";
}

/**
 * fetch() that follows redirects manually and re-checks every hop, so a public
 * URL cannot redirect the server into a blocked address.
 */
export async function fetchStreamTargetSafely(urlValue, init = {}, maxRedirects = 5) {
  let current = String(urlValue || "");
  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    const reason = await getBlockedStreamTargetReason(current);
    if (reason) {
      const error = new Error(reason);
      error.code = "STREAM_TARGET_BLOCKED";
      throw error;
    }
    const response = await fetch(current, { ...init, redirect: "manual" });
    const location = response.headers.get("location");
    if (response.status >= 300 && response.status < 400 && location) {
      try {
        await response.body?.cancel();
      } catch {
        // ignore
      }
      current = new URL(location, current).toString();
      continue;
    }
    return { response, finalUrl: current };
  }
  const error = new Error("Too many redirects.");
  error.code = "STREAM_TARGET_BLOCKED";
  throw error;
}
