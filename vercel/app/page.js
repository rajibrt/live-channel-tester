import IptvHomeClient from "../components/iptv/IptvHomeClient";
import PendingApprovalCard from "../components/client/PendingApprovalCard";
import PublicHomePage from "../components/site/PublicHomePage";
import { getFeaturedPublicArticles } from "../lib/publicArticles";
import { buildHomePageMetadata, loadSiteSeoSettingsCached } from "../lib/siteSeoSettings";
import { getCurrentClient } from "../lib/clientAuth";
import { loadClientAccessSettingsCached } from "../lib/clientAccessSettings";
import { getClientHomeData } from "../lib/clientHomeData";
import { getBaseUrl } from "../lib/siteUrl";

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
  const [resolvedSearchParams, current, accessSettings] = await Promise.all([
    searchParams,
    getCurrentClient().catch(() => null),
    loadClientAccessSettingsCached().catch(() => null),
  ]);
  const query = resolvedSearchParams || {};
  const publicGuestAccessEnabled = accessSettings?.public_guest_access_enabled === true;

  if (!current) {
    if (publicGuestAccessEnabled) {
      const boot = await getClientHomeData("");
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
          initialHomeMode={String(query?.mode || "").trim().toLowerCase() === "movies" ? "movies" : ""}
          initialMovieMode={String(query?.movie_mode || "").trim().toLowerCase()}
          initialMovieCategory={String(query?.movie_category || "").trim().toLowerCase()}
          initialMovieGenre={String(query?.movie_genre || "").trim().toLowerCase()}
          initialMovieLanguage={String(query?.movie_language || "").trim().toLowerCase()}
          initialMovieYear={String(query?.movie_year || "").trim()}
          initialMovieSearch={String(query?.movie_search || "").trim()}
          initialMovieFilterView={String(query?.movie_filter_view || "").trim().toLowerCase() === "genres" ? "genres" : "categories"}
          initialMoviePage={Math.max(1, Number.parseInt(String(query?.movie_page || "1"), 10) || 1)}
          initialClientState={boot.initialClientState}
          currentClient={{ fullName: "Guest", email: "", mobileNumber: "", avatarUrl: "", isGuest: true }}
          initialSelectedChannelId=""
          isGuest
        />
      );
    }
    const featuredArticles = await getFeaturedPublicArticles(21);
    const baseUrl = getBaseUrl();
    const publicSiteJsonLd = [
      {
        "@context": "https://schema.org",
        "@type": "Organization",
        name: "WEBTVBD",
        url: baseUrl,
        logo: `${baseUrl}/android-chrome-512x512.png`,
        contactPoint: {
          "@type": "ContactPoint",
          contactType: "editorial and customer support",
          url: `${baseUrl}/contact`,
        },
      },
      {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: "WEBTVBD",
        url: baseUrl,
        inLanguage: ["bn", "en"],
        publisher: { "@type": "Organization", name: "WEBTVBD", url: baseUrl },
      },
    ];
    return (
      <>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(publicSiteJsonLd) }} />
        <PublicHomePage featuredArticles={featuredArticles} />
      </>
    );
  }

  const approvalStatus = String(current?.client?.approval_status || "approved").toLowerCase();
  const isApproved = approvalStatus === "approved";

  if (!isApproved) {
    const isRejected = approvalStatus === "rejected";
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
      initialHomeMode={String(query?.mode || "").trim().toLowerCase() === "movies" ? "movies" : ""}
      initialMovieMode={String(query?.movie_mode || "").trim().toLowerCase()}
      initialMovieCategory={String(query?.movie_category || "").trim().toLowerCase()}
      initialMovieGenre={String(query?.movie_genre || "").trim().toLowerCase()}
      initialMovieLanguage={String(query?.movie_language || "").trim().toLowerCase()}
      initialMovieYear={String(query?.movie_year || "").trim()}
      initialMovieSearch={String(query?.movie_search || "").trim()}
      initialMovieFilterView={String(query?.movie_filter_view || "").trim().toLowerCase() === "genres" ? "genres" : "categories"}
      initialMoviePage={Math.max(1, Number.parseInt(String(query?.movie_page || "1"), 10) || 1)}
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
