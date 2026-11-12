import { execSync } from "node:child_process";

function compact(value) {
  return String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function getGitSha() {
  try {
    return compact(execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString());
  } catch {
    return "nogit";
  }
}

function getBuildVersion() {
  const fromEnv = compact(process.env.APP_BUILD_VERSION || process.env.NEXT_PUBLIC_BUILD_VERSION);
  if (fromEnv) return fromEnv;
  const stamp = compact(new Date().toISOString().replace(/[:]/g, "").replace(/\.\d{3}Z$/, "Z"));
  return `${stamp}-${getGitSha()}`;
}

const buildVersion = getBuildVersion();
process.env.NEXT_PUBLIC_BUILD_VERSION = buildVersion;

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  // Dev only: let phones on the same Wi-Fi open the local dev server (no effect in production).
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.16.*.*"],
  images: {
    localPatterns: [
      { pathname: "/editorial/**" },
      { pathname: "/logo.png" },
      { pathname: "/api/media/object" },
    ],
  },
  env: {
    NEXT_PUBLIC_BUILD_VERSION: buildVersion,
  },
  generateBuildId: async () => buildVersion,
  async headers() {
    return [
      {
        source: "/editorial/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;
