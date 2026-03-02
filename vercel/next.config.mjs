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
  env: {
    NEXT_PUBLIC_BUILD_VERSION: buildVersion,
  },
  generateBuildId: async () => buildVersion,
};

export default nextConfig;
