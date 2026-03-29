import PublicHomePage from "../components/site/PublicHomePage";
import { getFeaturedPublicArticles } from "../lib/publicArticles";
import { buildHomePageMetadata, loadSiteSeoSettingsCached } from "../lib/siteSeoSettings";
import { getLocaleFromRequest } from "../lib/i18n/server";
import { localizeArticles } from "../lib/articleLocalization";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  try {
    const settings = await loadSiteSeoSettingsCached();
    return buildHomePageMetadata(settings);
  } catch {
    return buildHomePageMetadata({});
  }
}

export default async function HomePage({ searchParams }) {
  const locale = await getLocaleFromRequest();
  await searchParams;
  const featuredArticles = await localizeArticles(await getFeaturedPublicArticles(21), locale);
  return <PublicHomePage featuredArticles={featuredArticles} />;
}
