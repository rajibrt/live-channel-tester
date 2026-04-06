import IptvHomeClient from "../../../components/iptv/IptvHomeClient";
import PendingApprovalCard from "../../../components/client/PendingApprovalCard";
import { requireClient } from "../../../lib/clientAuth";
import { loadClientAccessSettingsCached } from "../../../lib/clientAccessSettings";
import { getClientHomeData } from "../../../lib/clientHomeData";
import { getMovieBySlugForUser, getMovieCatalogBootstrapForUser, getPublishedMovieSeoBySlug } from "../../../lib/moviesData";

export const dynamic = "force-dynamic";

function inferImageType(url) {
  const value = String(url || "").toLowerCase();
  if (value.includes(".png")) return "image/png";
  if (value.includes(".webp")) return "image/webp";
  if (value.includes(".jpg") || value.includes(".jpeg")) return "image/jpeg";
  return "image/jpeg";
}

export async function generateMetadata({ params }) {
  const resolved = await params;
  const seo = await getPublishedMovieSeoBySlug(resolved?.slug);

  if (!seo) {
    return {
      title: "Movie Not Found | WEBTVBD",
      description: "The requested movie is not available on WEBTVBD.",
      robots: { index: false, follow: false },
    };
  }

  const movieTitle = seo.releaseYear ? `${seo.title} (${seo.releaseYear})` : seo.title;
  const socialImage = seo.socialImageUrl
    ? [{
        url: seo.socialImageUrl,
        secureUrl: seo.socialImageUrl,
        type: inferImageType(seo.socialImageUrl),
        width: 1200,
        height: 630,
        alt: movieTitle,
      }]
    : [];

  return {
    title: `${movieTitle} | WEBTVBD`,
    description: seo.description,
    robots: {
      index: false,
      follow: true,
    },
    alternates: { canonical: seo.canonicalUrl },
    openGraph: {
      type: "video.movie",
      url: seo.canonicalUrl,
      title: movieTitle,
      description: seo.description,
      images: socialImage,
    },
    twitter: {
      card: "summary_large_image",
      title: movieTitle,
      description: seo.description,
      images: seo.socialImageUrl ? [seo.socialImageUrl] : [],
    },
  };
}

export default async function MovieWatchPage({ params }) {
  const resolved = await params;
  const movieSlug = String(resolved?.slug || "").trim().toLowerCase();

  const current = await requireClient();
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

  const [boot, selectedMovie, movieBootstrap] = await Promise.all([
    getClientHomeData(current.user.id),
    getMovieBySlugForUser(current.user.id, movieSlug),
    getMovieCatalogBootstrapForUser(current.user.id, { includePage: false }),
  ]);

  return (
    <IptvHomeClient
      initialChannels={boot.channels}
      initialCategories={boot.categories}
      initialMovies={selectedMovie ? [selectedMovie] : []}
      initialMovieCategories={movieBootstrap.categories}
      initialMovieGenres={movieBootstrap.genres}
      initialMovieLanguages={movieBootstrap.languages}
      initialMovieYears={movieBootstrap.years}
      initialMovieStats={movieBootstrap.stats}
      initialContinueWatching={movieBootstrap.continueWatching}
      moviesViewVariant="watch"
      initialHomeMode="movies"
      initialSelectedMovieSlug={movieSlug}
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
