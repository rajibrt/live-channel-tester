import { getSupabaseAdmin } from "../lib/supabaseAdmin";
import { buildWatchPath } from "../lib/channelSlug";
import { getBaseUrl } from "../lib/siteUrl";

export default async function sitemap() {
  const baseUrl = getBaseUrl();
  const admin = getSupabaseAdmin();

  const { data: channels } = await admin
    .from("channels")
    .select("id,name,updated_at,status")
    .eq("status", "LIVE")
    .order("id", { ascending: true })
    .limit(50000);

  const urls = [
    {
      url: `${baseUrl}/`,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 1,
    },
    {
      url: `${baseUrl}/client-login`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    },
  ];

  for (const channel of channels || []) {
    const path = buildWatchPath({ id: channel?.id, name: channel?.name });
    if (!path) continue;
    urls.push({
      url: `${baseUrl}${path}`,
      lastModified: channel?.updated_at || new Date(),
      changeFrequency: "daily",
      priority: 0.7,
    });
  }

  return urls;
}
