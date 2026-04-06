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

  return urls;
}
