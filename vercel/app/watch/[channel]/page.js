import Link from "next/link";
import { permanentRedirect } from "next/navigation";
import IptvHomeClient from "../../../components/iptv/IptvHomeClient";
import PendingApprovalCard from "../../../components/client/PendingApprovalCard";
import { getCurrentClient } from "../../../lib/clientAuth";
import { getClientHomeData } from "../../../lib/clientHomeData";
import { buildChannelParam, parseChannelParam } from "../../../lib/channelSlug";
import { buildChannelSeoMeta, getChannelById } from "../../../lib/channelSeo";
import { getBaseUrl } from "../../../lib/siteUrl";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const resolved = await params;
  const { id } = parseChannelParam(resolved?.channel);
  const channel = await getChannelById(id);
  if (!channel) {
    return {
      title: "Channel Not Found | WEBTV BD",
      description: "The requested channel is not available.",
      robots: { index: false, follow: false },
    };
  }

  const seo = buildChannelSeoMeta(channel);
  return {
    title: seo.title,
    description: seo.description,
    alternates: { canonical: seo.canonicalUrl },
    openGraph: {
      type: "article",
      url: seo.canonicalUrl,
      title: seo.title,
      description: seo.description,
      images: [{ url: seo.logoUrl, width: 512, height: 512, alt: String(channel.name || "Channel logo") }],
    },
    twitter: {
      card: "summary_large_image",
      title: seo.title,
      description: seo.description,
      images: [seo.logoUrl],
    },
  };
}

function PublicChannelLanding({ channel }) {
  const seo = buildChannelSeoMeta(channel);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TVChannel",
    name: String(channel?.name || "Channel"),
    genre: String(channel?.category || "Live TV"),
    url: seo.canonicalUrl,
    image: seo.logoUrl,
    inLanguage: ["en", "bn"],
    isAccessibleForFree: true,
    publisher: {
      "@type": "Organization",
      name: "WEBTV BD",
      url: getBaseUrl(),
    },
  };

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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <section
        style={{
          width: "min(760px, 100%)",
          border: "1px solid var(--border)",
          borderRadius: "16px",
          padding: "24px",
          background: "color-mix(in oklab, var(--card) 92%, transparent)",
          display: "grid",
          gap: "16px",
        }}
      >
        <h1 style={{ margin: 0, fontSize: "clamp(1.5rem, 4vw, 2rem)" }}>{String(channel?.name || "Channel")}</h1>
        <p style={{ margin: 0, color: "var(--muted-foreground)" }}>
          Category: {String(channel?.category || "Live TV")} | Live stream available on WEBTV BD.
        </p>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <Link
            href="/client-login"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              textDecoration: "none",
              borderRadius: "10px",
              padding: "10px 14px",
              background: "linear-gradient(135deg,#ff005f,#ff3f00)",
              color: "#fff",
              fontWeight: 700,
            }}
          >
            Login to Watch
          </Link>
          <Link
            href="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              textDecoration: "none",
              borderRadius: "10px",
              padding: "10px 14px",
              border: "1px solid var(--border)",
              color: "var(--foreground)",
              fontWeight: 600,
            }}
          >
            Open Home
          </Link>
        </div>
      </section>
    </main>
  );
}

export default async function WatchChannelPage({ params }) {
  const resolved = await params;
  const { id } = parseChannelParam(resolved?.channel);
  const channel = await getChannelById(id);

  if (!channel) {
    return (
      <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", color: "var(--foreground)" }}>
        <p>Channel not found.</p>
      </main>
    );
  }

  const expectedSlug = buildChannelParam(channel);
  if (expectedSlug && expectedSlug !== resolved.channel) {
    permanentRedirect(`/watch/${expectedSlug}`);
  }

  const current = await getCurrentClient();
  if (!current) {
    return <PublicChannelLanding channel={channel} />;
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
      initialClientState={boot.initialClientState}
      currentClient={{
        email: String(current.client.email || ""),
        fullName: String(current.client.full_name || ""),
        mobileNumber: String(current.client.mobile_number || ""),
        avatarUrl: String(current.client.avatar_url || ""),
      }}
      initialSelectedChannelId={String(channel.id)}
    />
  );
}
