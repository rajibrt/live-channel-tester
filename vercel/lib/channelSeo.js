import { cache } from "react";
import { getSupabaseAdmin } from "./supabaseAdmin";
import { buildWatchPath } from "./channelSlug";
import { toAbsoluteUrl } from "./siteUrl";

export const getChannelById = cache(async (channelId) => {
  const id = Number(channelId);
  if (!Number.isFinite(id) || id <= 0) return null;

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("channels")
    .select("id,name,category,logo_url,status,playlist_slug,updated_at")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;
  return data;
});

export function buildChannelSeoMeta(channel) {
  const name = String(channel?.name || "Channel").trim() || "Channel";
  const category = String(channel?.category || "Live TV").trim() || "Live TV";
  const path = buildWatchPath({ id: channel?.id, name });
  const canonicalUrl = toAbsoluteUrl(path);
  const logoUrl = toAbsoluteUrl(channel?.logo_url || "/android-chrome-512x512.png");
  const title = `Watch ${name} Live | WEBTVBD`;
  const description = `Stream ${name} live on WEBTVBD. Category: ${category}. Watch channels online on mobile, desktop, and smart TV.`;

  return {
    title,
    description,
    canonicalUrl,
    logoUrl,
    path,
  };
}
