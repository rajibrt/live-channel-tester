import { getSupabaseAdmin } from "../lib/supabaseAdmin";
import { buildWatchPath } from "../lib/channelSlug";
import { getPublicArticles } from "../lib/publicArticles";
import { getBaseUrl } from "../lib/siteUrl";

export default async function sitemap() {
  const baseUrl = getBaseUrl();
  const publicArticles = await getPublicArticles().catch(() => []);

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
    {
      url: `${baseUrl}/articles`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${baseUrl}/contact`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${baseUrl}/privacy-policy`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/cookie-policy`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/dmca`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.4,
    },
  ];

  for (const article of publicArticles) {
    urls.push({
      url: `${baseUrl}${article.path}`,
      lastModified: article.updatedAt || article.publishedAt || new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    });
  }

  let channels = [];
  try {
    const admin = getSupabaseAdmin();
    const { data } = await admin
      .from("channels")
      .select("id,name,updated_at,status")
      .eq("status", "LIVE")
      .order("id", { ascending: true })
      .limit(50000);
    channels = data || [];
  } catch (error) {
    console.warn("sitemap: fallback to static URLs", error?.message || error);
  }

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
