import { cache } from "react";
import { resolveObjectUrl, resolvePublicObjectUrl } from "./objectStorage";
import { getSupabaseAdmin } from "./supabaseAdmin";
import { toAbsoluteUrl } from "./siteUrl";

const TABLE = "admin_announcements";

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

export function stripHtml(html) {
  return String(html || "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function slugify(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

function shortId(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 8);
}

export function buildPublicArticlePath(id, title) {
  const safeId = shortId(id);
  const safeTitle = cleanText(title) || "article";
  const titleSlug = slugify(safeTitle) || "article";
  return safeId ? `/articles/${titleSlug}-${safeId}` : `/articles/${titleSlug}`;
}

function estimateReadingMinutes(text) {
  const words = cleanText(text).split(" ").filter(Boolean).length;
  return Math.max(2, Math.ceil(words / 180));
}

async function normalizeArticle(row) {
  const title = cleanText(row?.title) || "Untitled article";
  const plain = stripHtml(row?.content_html);
  const path = buildPublicArticlePath(row?.id, title);
  const slug = path.split("/").pop() || slugify(title) || "article";
  const excerpt = plain.slice(0, 190);
  const publishedAt = String(row?.published_at || row?.updated_at || row?.created_at || "");
  const updatedAt = String(row?.updated_at || row?.published_at || row?.created_at || "");
  const featuredImageUrl = await resolveObjectUrl({
    bucket: row?.featured_image_bucket,
    path: row?.featured_image_path,
    fallbackUrl: row?.featured_image_url,
  });
  const socialImageUrl = resolvePublicObjectUrl({
    bucket: row?.featured_image_bucket,
    path: row?.featured_image_path,
    fallbackUrl: row?.featured_image_url,
  });

  return {
    id: String(row?.id || ""),
    source: "announcement",
    slug,
    title,
    description: excerpt || title,
    excerpt,
    publishedAt,
    updatedAt,
    readingMinutes: estimateReadingMinutes(plain),
    html: String(row?.content_html || ""),
    featuredImageUrl: cleanUrl(featuredImageUrl),
    socialImageUrl: cleanUrl(toAbsoluteUrl(socialImageUrl)),
    featuredImageBucket: cleanText(row?.featured_image_bucket),
    featuredImagePath: cleanText(row?.featured_image_path),
    featuredImageFallbackUrl: cleanUrl(row?.featured_image_url),
    path,
    canonicalUrl: toAbsoluteUrl(path),
  };
}

function isArticleRow(row) {
  // Articles and announcements are completely separate systems.
  // Only rows with content_type = 'article' appear in the public article feed.
  // Legacy rows without the column (old schema had no articles) are excluded.
  return cleanText(row?.content_type).toLowerCase() === "article";
}

function cleanUrl(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  return /^https?:\/\//i.test(text) || text.startsWith("/") ? text : "";
}

async function loadPublishedAnnouncementArticles(limit = 24) {
  const admin = getSupabaseAdmin();
  const buildQuery = (selectClause) =>
    admin
      .from(TABLE)
      .select(selectClause)
      .eq("is_published", true)
      .order("is_pinned", { ascending: false })
      .order("position", { ascending: true })
      .order("published_at", { ascending: false })
      .limit(limit);

  let { data, error } = await buildQuery(
    "id,title,content_html,content_type,featured_image_url,featured_image_path,featured_image_bucket,published_at,updated_at,created_at,is_published,is_pinned,show_title_in_ticker,position"
  );

  if (error) {
    const lower = String(error?.message || "").toLowerCase();
    const missingContentType = String(error?.code || "") === "42703" || lower.includes("content_type");
    if (!missingContentType) return [];
    ({ data, error } = await buildQuery(
      "id,title,content_html,featured_image_url,featured_image_path,featured_image_bucket,published_at,updated_at,created_at,is_published,is_pinned,show_title_in_ticker,position"
    ));
    if (error) return [];
  }

  return await Promise.all((Array.isArray(data) ? data : []).filter(isArticleRow).map(normalizeArticle));
}

export const getPublicArticles = cache(async () => {
  const dbArticles = await loadPublishedAnnouncementArticles(32);
  const merged = [...dbArticles].sort((a, b) => {
    return new Date(b.updatedAt || b.publishedAt || 0).getTime() - new Date(a.updatedAt || a.publishedAt || 0).getTime();
  });
  return merged;
});

export async function getFeaturedPublicArticles(limit = 6) {
  const all = await getPublicArticles();
  return all.slice(0, Math.max(1, Number(limit) || 6));
}

export async function getPublicArticleBySlug(slug) {
  const key = cleanText(slug).toLowerCase();
  if (!key) return null;
  const articles = await getPublicArticles();
  return articles.find((item) => String(item.slug || "").toLowerCase() === key) || null;
}
