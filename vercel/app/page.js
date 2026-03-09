import IptvHomeClient from "../components/iptv/IptvHomeClient";
import { requireClient } from "../lib/clientAuth";
import PendingApprovalCard from "../components/client/PendingApprovalCard";
import { loadClientAccessSettingsCached } from "../lib/clientAccessSettings";
import { getClientHomeData } from "../lib/clientHomeData";
import { buildHomePageMetadata, loadSiteSeoSettingsCached } from "../lib/siteSeoSettings";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  try {
    const settings = await loadSiteSeoSettingsCached();
    return buildHomePageMetadata(settings);
  } catch {
    return buildHomePageMetadata({});
  }
}

export default async function HomePage() {
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

  const boot = await getClientHomeData(current.user.id);

  return (
    <IptvHomeClient
      initialChannels={boot.channels}
      initialCategories={boot.categories}
      initialMovies={boot.movies}
      initialMovieCategories={boot.movieCategories}
      initialContinueWatching={boot.continueWatching}
      moviesViewVariant="browse"
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
