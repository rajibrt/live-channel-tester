import { getBaseUrl } from "../lib/siteUrl";

export default function robots() {
  const baseUrl = getBaseUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/dashboard/", "/api/"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
