import PendingApprovalCard from "../components/client/PendingApprovalCard";
import PublicHomePage from "../components/site/PublicHomePage";
import { getFeaturedPublicArticles } from "../lib/publicArticles";
import { buildHomePageMetadata, loadSiteSeoSettingsCached } from "../lib/siteSeoSettings";
import { getCurrentClient } from "../lib/clientAuth";
import { loadClientAccessSettingsCached } from "../lib/clientAccessSettings";
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

export default async function HomePage() {
  const [current, accessSettings, featuredArticles] = await Promise.all([
    getCurrentClient().catch(() => null),
    loadClientAccessSettingsCached().catch(() => null),
    getFeaturedPublicArticles(21),
  ]);

  const approvalStatus = String(current?.client?.approval_status || "approved").toLowerCase();
  if (current && approvalStatus !== "approved") {
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
