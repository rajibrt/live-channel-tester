const DEFAULT_BASE_URL = "https://webtvbd.com";
const ADSENSE_PUBLISHER_ID = "pub-3010934061489506";

const LEGACY_ARTICLE_PATHS = [
  "/articles/bangladesh-television-the-pioneer-of-broadcasting-in-bangladesh-064a26f9",
  "/articles/online-live-tv-ott-platform-2cb453ce",
  "/articles/top-10-bangladeshi-tv-channels-you-can-watch-online-in-2026-b77246e3",
  "/articles/how-to-watch-live-tv-channels-in-bangladesh-for-free-on-any-device-5474a282",
  "/articles/popular-actor-rahul-dies-after-drowning-193f727c",
];

function normalizeBaseUrl(value) {
  const parsed = new URL(String(value || DEFAULT_BASE_URL));
  parsed.pathname = "/";
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString().replace(/\/$/, "");
}

function extractAll(value, pattern) {
  return [...String(value || "").matchAll(pattern)].map((match) => match[1]);
}

function extractOne(value, pattern) {
  return String(value || "").match(pattern)?.[1]?.trim() || "";
}

function decodeEntities(value) {
  return String(value || "")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function comparableUrl(value) {
  const parsed = new URL(String(value || ""), baseUrl);
  parsed.hash = "";
  const href = parsed.href;
  return parsed.pathname === "/" && !parsed.search ? href.replace(/\/$/, "") : href;
}

async function fetchWithTimeout(url, options = {}) {
  return fetch(url, { redirect: "manual", signal: AbortSignal.timeout(20_000), ...options });
}

const baseUrl = normalizeBaseUrl(process.argv[2] || process.env.PUBLIC_AUDIT_BASE_URL);
const failures = [];
const warnings = [];

function fail(message) {
  failures.push(message);
}

function warn(message) {
  warnings.push(message);
}

async function readRequired(path, expectedType = "") {
  const url = `${baseUrl}${path}`;
  const response = await fetchWithTimeout(url, { redirect: "follow" });
  const body = await response.text();
  if (!response.ok) fail(`${path} returned HTTP ${response.status}`);
  if (expectedType && !String(response.headers.get("content-type") || "").includes(expectedType)) {
    fail(`${path} has unexpected content-type: ${response.headers.get("content-type") || "missing"}`);
  }
  return { response, body, url };
}

const [{ body: robots }, { body: sitemap }, { body: adsText }] = await Promise.all([
  readRequired("/robots.txt", "text/plain"),
  readRequired("/sitemap.xml", "xml"),
  readRequired("/ads.txt", "text/plain"),
]);

if (!robots.includes(`Sitemap: ${baseUrl}/sitemap.xml`)) fail("robots.txt does not declare the canonical sitemap URL");
if (!/User-Agent:\s*\*/i.test(robots) || !/Allow:\s*\//i.test(robots)) fail("robots.txt does not explicitly allow public crawling");
if (!adsText.includes(`google.com, ${ADSENSE_PUBLISHER_ID}, DIRECT, f08c47fec0942fa0`)) {
  fail(`ads.txt is missing the authorized ${ADSENSE_PUBLISHER_ID} DIRECT record`);
}

const sitemapUrls = extractAll(sitemap, /<loc>([^<]+)<\/loc>/g).map(decodeEntities);
if (!sitemapUrls.length) fail("sitemap.xml contains no URLs");
if (new Set(sitemapUrls).size !== sitemapUrls.length) fail("sitemap.xml contains duplicate URLs");
if (sitemapUrls.some((url) => !url.startsWith(`${baseUrl}/`) && url !== baseUrl)) fail("sitemap.xml contains a non-canonical host");

const pageRecords = [];
for (const url of sitemapUrls) {
  const response = await fetchWithTimeout(url, { redirect: "follow" });
  const html = await response.text();
  const path = new URL(url).pathname;
  const title = decodeEntities(extractOne(html, /<title[^>]*>([\s\S]*?)<\/title>/i));
  const description = decodeEntities(extractOne(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["'][^>]*>/i));
  const canonical = decodeEntities(extractOne(html, /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["'][^>]*>/i));
  const h1Count = (html.match(/<h1\b/gi) || []).length;
  const robotsMeta = extractOne(html, /<meta[^>]+name=["']robots["'][^>]+content=["']([^"']+)["'][^>]*>/i).toLowerCase();
  const robotsHeader = String(response.headers.get("x-robots-tag") || "").toLowerCase();

  if (!response.ok) fail(`${path} returned HTTP ${response.status}`);
  if (comparableUrl(response.url) !== comparableUrl(url)) fail(`${path} redirected to ${response.url}`);
  if (!title) fail(`${path} has no document title`);
  if (!description) fail(`${path} has no meta description`);
  if (!canonical || comparableUrl(canonical) !== comparableUrl(url)) fail(`${path} canonical mismatch: ${canonical || "missing"}`);
  if (h1Count !== 1) fail(`${path} has ${h1Count} H1 elements; expected 1`);
  if (robotsMeta.includes("noindex") || robotsHeader.includes("noindex")) fail(`${path} is marked noindex`);

  if (path.startsWith("/articles/")) {
    if (!/application\/ld\+json/i.test(html) || !/"@type":"Article"/.test(html)) fail(`${path} is missing Article JSON-LD`);
    if (!/<img[^>]+(?:\/editorial\/|\/api\/media\/object)/i.test(html)) warn(`${path} has no recognizable editorial image`);
    if (!/target=["']_blank["'][^>]+rel=["'][^"']*noopener/i.test(html)) warn(`${path} has no external source link with safe attributes`);
  }

  pageRecords.push({ path, title, description });
}

for (const field of ["title", "description"]) {
  const seen = new Map();
  for (const page of pageRecords) {
    const key = page[field].toLowerCase();
    if (!key) continue;
    if (seen.has(key)) warn(`duplicate ${field}: ${seen.get(key)} and ${page.path}`);
    else seen.set(key, page.path);
  }
}

for (const path of LEGACY_ARTICLE_PATHS) {
  const response = await fetchWithTimeout(`${baseUrl}${path}`);
  const location = response.headers.get("location") || "";
  if (![301, 308].includes(response.status)) fail(`${path} should permanently redirect, received HTTP ${response.status}`);
  if (!location.includes("/articles/") || location.endsWith(path)) fail(`${path} has an invalid redirect target: ${location || "missing"}`);
}

const wwwUrl = new URL(baseUrl);
wwwUrl.hostname = `www.${wwwUrl.hostname.replace(/^www\./, "")}`;
const wwwResponse = await fetchWithTimeout(wwwUrl.toString());
if (![301, 308].includes(wwwResponse.status) || !String(wwwResponse.headers.get("location") || "").startsWith(baseUrl)) {
  fail(`www host is not permanently redirected to ${baseUrl}`);
}

const articleCount = sitemapUrls.filter((url) => new URL(url).pathname.startsWith("/articles/")).length;
console.log(`Public-site audit: ${baseUrl}`);
console.log(`Sitemap URLs: ${sitemapUrls.length}`);
console.log(`Article URLs: ${articleCount}`);
console.log(`Legacy redirects: ${LEGACY_ARTICLE_PATHS.length}`);
console.log(`Warnings: ${warnings.length}`);
for (const message of warnings) console.log(`  WARN ${message}`);
console.log(`Failures: ${failures.length}`);
for (const message of failures) console.error(`  FAIL ${message}`);

if (failures.length) process.exitCode = 1;
