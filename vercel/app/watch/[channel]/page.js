import Link from "next/link";
import { permanentRedirect } from "next/navigation";
import IptvHomeClient from "../../../components/iptv/IptvHomeClient";
import PendingApprovalCard from "../../../components/client/PendingApprovalCard";
import { getCurrentClient } from "../../../lib/clientAuth";
import { loadClientAccessSettingsCached } from "../../../lib/clientAccessSettings";
import { getClientHomeData } from "../../../lib/clientHomeData";
import { buildChannelParam, parseChannelParam } from "../../../lib/channelSlug";
import { buildChannelSeoMeta, getChannelById } from "../../../lib/channelSeo";
import { getLocaleFromRequest } from "../../../lib/i18n/server";
import { getBaseUrl } from "../../../lib/siteUrl";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const resolved = await params;
  const { id } = parseChannelParam(resolved?.channel);
  const channel = await getChannelById(id);
  if (!channel) {
    return {
      title: "Channel Not Found | WEBTVBD",
      description: "The requested channel is not available.",
      robots: { index: false, follow: false },
    };
  }

  const seo = buildChannelSeoMeta(channel);
  return {
    title: seo.title,
    description: seo.description,
    robots: {
      index: false,
      follow: true,
    },
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

function PublicChannelLanding({ channel, locale = "en" }) {
  const seo = buildChannelSeoMeta(channel);
  const copy =
    locale === "bn"
      ? {
          category: "ক্যাটাগরি",
          liveAvailable: "লাইভ স্ট্রিম WEBTVBD-তে উপলভ্য।",
          sourceTitle: "অ্যাভেইলেবিলিটি নোটিশ",
          sourceBody:
            "Channel listing, playback status এবং access availability সময়ের সাথে বদলাতে পারে। Operational review, content update, technical issue বা rights-related request-এর কারণে কোনো item update, restrict বা remove করা হতে পারে.",
          login: "দেখতে লগইন করুন",
          home: "হোম খুলুন",
          notFound: "চ্যানেল পাওয়া যায়নি।",
        }
      : {
          category: "Category",
          liveAvailable: "Live stream available on WEBTVBD.",
          sourceTitle: "Availability Notice",
          sourceBody:
            "Channel listings, playback status, and access availability can change over time. Items may be updated, restricted, or removed when operational review, content updates, technical issues, or rights-related requests require changes.",
          login: "Login to Watch",
          home: "Open Home",
          notFound: "Channel not found.",
        };
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
      name: "WEBTVBD",
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
          {copy.category}: {String(channel?.category || "Live TV")} | {copy.liveAvailable}
        </p>
        <section
          style={{
            display: "grid",
            gap: "8px",
            padding: "16px 18px",
            border: "1px solid color-mix(in oklab, var(--primary) 44%, var(--border))",
            borderRadius: "14px",
            background:
              "linear-gradient(135deg, color-mix(in oklab, var(--primary) 18%, transparent), transparent 68%), color-mix(in oklab, var(--card) 96%, transparent)",
            boxShadow: "var(--shadow-lg)",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: "0.82rem",
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "color-mix(in oklab, var(--primary) 76%, var(--foreground))",
            }}
          >
            {copy.sourceTitle}
          </p>
          <p style={{ margin: 0, lineHeight: 1.75 }}>{copy.sourceBody}</p>
        </section>
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
            {copy.login}
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
            {copy.home}
          </Link>
        </div>
      </section>
    </main>
  );
}

export default async function WatchChannelPage({ params, searchParams }) {
  const resolved = await params;
  const query = await searchParams;
  const { id } = parseChannelParam(resolved?.channel);
  const channel = await getChannelById(id);
  const locale = await getLocaleFromRequest();

  if (!channel) {
    return (
      <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", color: "var(--foreground)" }}>
        <p>{locale === "bn" ? "চ্যানেল পাওয়া যায়নি।" : "Channel not found."}</p>
      </main>
    );
  }

  const expectedSlug = buildChannelParam(channel);
  if (expectedSlug && expectedSlug !== resolved.channel) {
    permanentRedirect(`/watch/${expectedSlug}`);
  }

  const current = await getCurrentClient();
  if (!current) {
    return <PublicChannelLanding channel={channel} locale={locale} />;
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
      initialSelectedChannelId={String(channel.id)}
    />
  );
}
