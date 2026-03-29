import PublicHomePage from "../components/site/PublicHomePage";
import IptvHomeClient from "../components/iptv/IptvHomeClient";
import { getCurrentClient } from "../lib/clientAuth";
import PendingApprovalCard from "../components/client/PendingApprovalCard";
import { loadClientAccessSettingsCached } from "../lib/clientAccessSettings";
import { getClientHomeData } from "../lib/clientHomeData";
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
  const params = await searchParams;
  const initialHomeMode = String(params?.mode || "").trim().toLowerCase() === "movies" ? "movies" : "";
  const initialMovieMode = String(params?.movie_mode || "").trim().toLowerCase();
  const initialMovieCategory = String(params?.movie_category || "").trim().toLowerCase();
  const initialMovieGenre = String(params?.movie_genre || "").trim().toLowerCase();
  const initialMovieLanguage = String(params?.movie_language || "").trim().toLowerCase();
  const initialMovieYear = String(params?.movie_year || "").trim();
  const initialMovieFilterView = String(params?.movie_filter_view || "").trim().toLowerCase() === "genres" ? "genres" : "categories";
  const initialMoviePage = Math.max(1, Number.parseInt(String(params?.movie_page || "1"), 10) || 1);
  const current = await getCurrentClient();
  if (!current) {
    const featuredArticles = await localizeArticles(await getFeaturedPublicArticles(4), locale);
    return <PublicHomePage featuredArticles={featuredArticles} />;
  }

  const approvalStatus = String(current?.client?.approval_status || "approved").toLowerCase();
  const isApproved = approvalStatus === "approved";
  if (!isApproved) {
    const isRejected = approvalStatus === "rejected";
    const accessSettings = await loadClientAccessSettingsCached().catch(() => null);
    return (
      <main
        style={{
          minHeight: "100dvh",
          margin: 0,
          display: "grid",
          placeItems: "center",
          padding: "24px",
          background: "var(--background)",
          color: "var(--foreground)",
        }}
      >
        <section
          style={{
            width: "min(680px, 100%)",
            border: "1px solid var(--border)",
            borderRadius: "16px",
            padding: "20px",
            background: "color-mix(in oklab, var(--card) 92%, transparent)",
          }}
        >
          <PendingApprovalCard
            isRejected={isRejected}
            initialMobile={String(current?.client?.mobile_number || "")}
            requiresAdminApproval={accessSettings?.facebook_first_login_requires_admin_approval !== false}
          />
        </section>
      </main>
    );
  }

  const boot = await getClientHomeData(current.user.id);

  return (
    <IptvHomeClient
      initialChannels={boot.channels}
      initialCategories={boot.categories}
      initialMovies={boot.movies}
      initialMovieCategories={boot.movieCategories}
      initialMovieGenres={boot.movieGenres}
      initialMovieLanguages={boot.movieLanguages}
      initialMovieYears={boot.movieYears}
      initialMovieStats={boot.movieStats}
      initialContinueWatching={boot.continueWatching}
      moviesViewVariant="browse"
      initialHomeMode={initialHomeMode}
      initialMovieMode={initialMovieMode}
      initialMovieCategory={initialMovieCategory}
      initialMovieGenre={initialMovieGenre}
      initialMovieLanguage={initialMovieLanguage}
      initialMovieYear={initialMovieYear}
      initialMovieFilterView={initialMovieFilterView}
      initialMoviePage={initialMoviePage}
      initialClientState={boot.initialClientState}
      currentClient={{
        email: String(current.client.email || ""),
        fullName: String(current.client.full_name || ""),
        mobileNumber: String(current.client.mobile_number || ""),
        avatarUrl: String(current.client.avatar_url || ""),
      }}
      initialSelectedChannelId=""
    />
  );
}
