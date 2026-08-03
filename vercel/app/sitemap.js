import { getPublicArticles } from "../lib/publicArticles";
import { getBaseUrl } from "../lib/siteUrl";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function sitemap() {
  const baseUrl = getBaseUrl();
  const publicArticles = await getPublicArticles().catch(() => []);
  const staticLastModified = new Date("2026-08-03T00:00:00.000Z");

  const urls = [
    {
      url: `${baseUrl}/`,
      lastModified: staticLastModified,
      changeFrequency: "hourly",
      priority: 1,
    },
    {
      url: `${baseUrl}/articles`,
      lastModified: staticLastModified,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: staticLastModified,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${baseUrl}/contact`,
      lastModified: staticLastModified,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${baseUrl}/privacy-policy`,
      lastModified: staticLastModified,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/cookie-policy`,
      lastModified: staticLastModified,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: staticLastModified,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/dmca`,
      lastModified: staticLastModified,
      changeFrequency: "monthly",
      priority: 0.4,
    },
    {
      url: `${baseUrl}/editorial-policy`,
      lastModified: staticLastModified,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/corrections-policy`,
      lastModified: staticLastModified,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/advertising-disclosure`,
      lastModified: staticLastModified,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/editorial-team`,
      lastModified: staticLastModified,
      changeFrequency: "monthly",
      priority: 0.5,
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

  return urls;
}
