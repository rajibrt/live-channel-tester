import { cache } from "react";
import { getSupabaseAdmin } from "./supabaseAdmin";
import { getBaseUrl, toAbsoluteUrl } from "./siteUrl";
import { formatSettingsDbError } from "./emailDelivery";

const SETTINGS_TABLE = "admin_settings";
const SETTINGS_KEY = "site_seo";

function toCleanString(value, max = 400) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function toMultilineString(value, max = 1000) {
  return String(value || "").trim().slice(0, max);
}

function toOgImageUrl(value, fallback = "") {
  const raw = toCleanString(value, 1000);
  if (!raw) return fallback;
  return toAbsoluteUrl(raw) || fallback;
}

export function getDefaultSiteSeoSettings() {
  const baseUrl = getBaseUrl();
  return {
    site_name: "WEBTVBD",
    home_title: "WEBTVBD || TV Beyond Borders",
    home_description: "WEBTVBD live streaming platform for channels, categories, and on-demand viewer access.",
    og_title: "WEBTVBD || TV Beyond Borders",
    og_description: "Watch live channels, movies, and viewer content on WEBTVBD.",
    og_image_url: `${baseUrl}/android-chrome-512x512.png`,
    og_image_alt: "WEBTVBD social preview",
    og_image_path: "",
    og_image_bucket: "",
  };
}

export function normalizeSiteSeoSettings(valueJson) {
  const raw = valueJson && typeof valueJson === "object" ? valueJson : {};
  const defaults = getDefaultSiteSeoSettings();
  const homeTitle = toCleanString(raw.home_title || defaults.home_title, 160) || defaults.home_title;
  const homeDescription = toMultilineString(raw.home_description || defaults.home_description, 320) || defaults.home_description;

  return {
    site_name: toCleanString(raw.site_name || defaults.site_name, 120) || defaults.site_name,
    home_title: homeTitle,
    home_description: homeDescription,
    og_title: toCleanString(raw.og_title || homeTitle, 160) || homeTitle,
    og_description: toMultilineString(raw.og_description || homeDescription, 320) || homeDescription,
    og_image_url: toOgImageUrl(raw.og_image_url, defaults.og_image_url),
    og_image_alt: toCleanString(raw.og_image_alt || defaults.og_image_alt, 160) || defaults.og_image_alt,
    og_image_path: toCleanString(raw.og_image_path || defaults.og_image_path, 320),
    og_image_bucket: toCleanString(raw.og_image_bucket || defaults.og_image_bucket, 120),
  };
}

export async function loadSiteSeoSettings(adminClient) {
  const admin = adminClient || getSupabaseAdmin();
  const { data, error } = await admin
    .from(SETTINGS_TABLE)
    .select("value_json")
    .eq("key", SETTINGS_KEY)
    .maybeSingle();

  if (error) {
    throw new Error(formatSettingsDbError(error, "Failed to load site SEO settings."));
  }

  return normalizeSiteSeoSettings(data?.value_json || {});
}

export const loadSiteSeoSettingsCached = cache(async () => {
  return await loadSiteSeoSettings();
});

async function deleteManagedOgImage({ adminClient, bucket = "", path = "" }) {
  const safeBucket = toCleanString(bucket, 120);
  const safePath = toCleanString(path, 320);
  if (!safeBucket || !safePath) return;
  const admin = adminClient || getSupabaseAdmin();
  const { error } = await admin.storage.from(safeBucket).remove([safePath]);
  if (error) throw new Error(`Failed to remove old Open Graph image: ${error.message}`);
}

export async function saveSiteSeoSettings({ adminUserId = "", patch = {}, adminClient }) {
  const admin = adminClient || getSupabaseAdmin();
  const current = await loadSiteSeoSettings(admin);
  const next = normalizeSiteSeoSettings({ ...current, ...(patch && typeof patch === "object" ? patch : {}) });
  const oldManagedImage =
    current.og_image_bucket && current.og_image_path
      ? { bucket: current.og_image_bucket, path: current.og_image_path }
      : null;
  const nextManagedImage =
    next.og_image_bucket && next.og_image_path
      ? { bucket: next.og_image_bucket, path: next.og_image_path }
      : null;
  const payload = {
    key: SETTINGS_KEY,
    value_json: next,
    updated_by_admin: adminUserId || null,
    updated_at: new Date().toISOString(),
  };

  let { error } = await admin.from(SETTINGS_TABLE).upsert(payload, { onConflict: "key" });
  const updatedByFkError =
    String(error?.code || "") === "23503" &&
    String(error?.message || "").includes("admin_settings_updated_by_admin_fkey");

  if (updatedByFkError) {
    ({ error } = await admin.from(SETTINGS_TABLE).upsert({ ...payload, updated_by_admin: null }, { onConflict: "key" }));
  }

  if (error) {
    throw new Error(formatSettingsDbError(error, "Failed to save site SEO settings."));
  }

  const shouldDeleteOldManagedImage =
    oldManagedImage &&
    (!nextManagedImage ||
      oldManagedImage.bucket !== nextManagedImage.bucket ||
      oldManagedImage.path !== nextManagedImage.path);

  if (shouldDeleteOldManagedImage) {
    await deleteManagedOgImage({
      adminClient: admin,
      bucket: oldManagedImage.bucket,
      path: oldManagedImage.path,
    }).catch(() => {});
  }

  return next;
}

export function buildHomePageMetadata(settings) {
  const normalized = normalizeSiteSeoSettings(settings);
  const baseUrl = getBaseUrl();

  return {
    title: normalized.home_title,
    description: normalized.home_description,
    alternates: { canonical: baseUrl },
    openGraph: {
      type: "website",
      url: baseUrl,
      siteName: normalized.site_name,
      title: normalized.og_title,
      description: normalized.og_description,
      images: [
        {
          url: normalized.og_image_url,
          alt: normalized.og_image_alt,
          width: 1200,
          height: 630,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: normalized.og_title,
      description: normalized.og_description,
      images: [normalized.og_image_url],
    },
  };
}
