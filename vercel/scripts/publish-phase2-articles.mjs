import { readFile, stat } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DeleteObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";
import { STATIC_EDITORIAL_ARTICLES_PHASE_2 } from "../lib/staticEditorialArticlesPhase2.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(HERE, "..");
const SOURCE_DIR = "/Users/Kayum_1/Downloads/webtvbd-images/anywebp_1785761417070";
const BUCKET = String(process.env.ARTICLE_IMAGE_BUCKET || process.env.OBJECT_STORAGE_BUCKET_IMAGES || "webtvbd").trim();
const FOLDER = "articles/2026-08-03-hires";
const RETIRED_FOLDER = "articles/2026-08-03";

const imageByArticleId = new Map([
  ["f6a109b2-static-hdmi-earc", "hdmi-earc-soundbar-guide.webp"],
  ["07b21ac3-static-tv-storage", "smart-tv-storage-maintenance.webp"],
  ["18c32bd4-static-stream-account", "streaming-account-security.webp"],
  ["29d43ce5-static-picture-hdr", "tv-picture-hdr-settings.webp"],
  ["3ae54df6-static-live-sports", "live-sports-streaming-setup.webp"],
  ["4bf65ea7-static-offline-download", "offline-video-downloads.webp"],
  ["5c076fb8-static-subscription", "streaming-subscription-control.webp"],
  ["6d1870c9-static-audio-sync", "tv-audio-sync-dialogue.webp"],
  ["7e2981da-static-guest-wifi", "guest-wifi-casting.webp"],
  ["8f3a92eb-static-phishing", "fake-streaming-app-phishing.webp"],
]);

function required(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function boolEnv(name, fallback) {
  const value = String(process.env[name] || "").trim().toLowerCase();
  if (!value) return fallback;
  return !["0", "false", "no", "off"].includes(value);
}

function publicObjectUrl(key) {
  const publicBase = String(process.env.OBJECT_STORAGE_PUBLIC_BASE_URL || "").trim();
  if (publicBase) return `${publicBase.replace(/\/+$/, "")}/${key}`;
  const endpoint = required("OBJECT_STORAGE_ENDPOINT").replace(/\/+$/, "");
  if (boolEnv("OBJECT_STORAGE_USE_PATH_STYLE", true)) return `${endpoint}/${BUCKET}/${key}`;
  const url = new URL(endpoint);
  return `${url.protocol}//${BUCKET}.${url.host}/${key}`;
}

if (String(process.env.OBJECT_STORAGE_PROVIDER || "").trim().toLowerCase() === "supabase") {
  throw new Error("This migration expects the configured S3-compatible article image bucket.");
}
if (STATIC_EDITORIAL_ARTICLES_PHASE_2.length !== 10 || imageByArticleId.size !== 10) {
  throw new Error("Expected exactly ten Phase 2 articles and ten image mappings.");
}

const s3 = new S3Client({
  region: String(process.env.OBJECT_STORAGE_REGION || "us-east-1").trim() || "us-east-1",
  endpoint: required("OBJECT_STORAGE_ENDPOINT"),
  forcePathStyle: boolEnv("OBJECT_STORAGE_USE_PATH_STYLE", true),
  credentials: {
    accessKeyId: required("OBJECT_STORAGE_ACCESS_KEY"),
    secretAccessKey: required("OBJECT_STORAGE_SECRET_KEY"),
  },
});

const db = createClient(required("SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false },
});

const prepared = [];
for (const article of STATIC_EDITORIAL_ARTICLES_PHASE_2) {
  const filename = imageByArticleId.get(article.id);
  if (!filename) throw new Error(`No image mapping for ${article.id}`);
  const filePath = path.join(SOURCE_DIR, filename);
  const info = await stat(filePath);
  if (!info.isFile() || info.size <= 0 || info.size > 5 * 1024 * 1024) {
    throw new Error(`Invalid image file: ${filePath}`);
  }
  const bytes = await readFile(filePath);
  if (bytes.subarray(0, 4).toString("ascii") !== "RIFF" || bytes.subarray(8, 12).toString("ascii") !== "WEBP") {
    throw new Error(`Not a WebP file: ${filePath}`);
  }
  prepared.push({ article, filename, key: `${FOLDER}/${filename}`, bytes });
}

for (const item of prepared) {
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: item.key,
    Body: item.bytes,
    ContentType: "image/webp",
    CacheControl: "public, max-age=31536000, immutable",
  }));
  const head = await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: item.key }));
  if (Number(head.ContentLength || 0) !== item.bytes.length) {
    throw new Error(`Uploaded size mismatch for ${item.key}`);
  }
}

const titles = prepared.map((item) => item.article.title);
const existingResult = await db
  .from("admin_announcements")
  .select("id,title,position,created_at,published_at")
  .in("title", titles);
if (existingResult.error) throw existingResult.error;
const existingByTitle = new Map((existingResult.data || []).map((row) => [row.title, row]));

const maxPositionResult = await db
  .from("admin_announcements")
  .select("position")
  .order("position", { ascending: false })
  .limit(1)
  .maybeSingle();
if (maxPositionResult.error) throw maxPositionResult.error;
let nextPosition = Number(maxPositionResult.data?.position || 0) + 1;

const rows = prepared.map(({ article, key }) => {
  const existing = existingByTitle.get(article.title);
  return {
    id: existing?.id || randomUUID(),
    title: article.title,
    content_html: article.content_html,
    content_type: "article",
    featured_image_url: publicObjectUrl(key),
    featured_image_path: key,
    featured_image_bucket: BUCKET,
    position: existing?.position || nextPosition++,
    is_published: true,
    is_pinned: false,
    show_title_in_ticker: false,
    published_at: existing?.published_at || article.published_at,
    created_at: existing?.created_at || article.published_at,
    updated_at: article.updated_at,
  };
});

const upsertResult = await db
  .from("admin_announcements")
  .upsert(rows, { onConflict: "id" })
  .select("id,title,featured_image_bucket,featured_image_path,position,is_published,content_type");
if (upsertResult.error) throw upsertResult.error;

const verifyResult = await db
  .from("admin_announcements")
  .select("id,title,featured_image_bucket,featured_image_path,position,is_published,content_type")
  .in("title", titles);
if (verifyResult.error) throw verifyResult.error;
if ((verifyResult.data || []).length !== 10) {
  throw new Error(`Database verification returned ${verifyResult.data?.length || 0} rows instead of 10.`);
}

const retired = [];
for (const item of prepared) {
  const retiredKey = `${RETIRED_FOLDER}/${item.filename}`;
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: retiredKey }));
  retired.push(retiredKey);
}

console.log(JSON.stringify({
  ok: true,
  bucket: BUCKET,
  uploaded: prepared.map(({ key, bytes }) => ({ key, bytes: bytes.length })),
  databaseRows: (verifyResult.data || []).map((row) => ({
    id: row.id,
    title: row.title,
    path: row.featured_image_path,
    published: row.is_published,
    type: row.content_type,
  })),
  retired,
  projectRoot: PROJECT_ROOT,
}, null, 2));
