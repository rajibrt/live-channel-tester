import IptvHomeClient from "../../../components/iptv/IptvHomeClient";
import PendingApprovalCard from "../../../components/client/PendingApprovalCard";
import { requireClient } from "../../../lib/clientAuth";
import { loadClientAccessSettingsCached } from "../../../lib/clientAccessSettings";
import { getClientHomeData } from "../../../lib/clientHomeData";
import { getMovieBySlugForUser, getMovieCatalogBootstrapForUser } from "../../../lib/moviesData";

export const dynamic = "force-dynamic";

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
