import IptvHomeClient from "../components/iptv/IptvHomeClient";
import { getHomeIptvData } from "../components/iptv/homeData";
import { requireClient } from "../lib/clientAuth";
import { getSupabaseAdmin } from "../lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const current = await requireClient();
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
          <h1 style={{ margin: "0 0 10px", fontSize: "26px" }}>
            {isRejected ? "Profile Not Approved" : "Profile Under Review"}
          </h1>
          <p style={{ margin: "0 0 8px", color: "var(--muted-foreground)" }}>
            {isRejected
              ? "Your profile was not approved yet. Please contact support or try again later."
              : "Your account was created successfully, but admin approval is still pending."}
          </p>
          <p style={{ margin: "0 0 18px", color: "var(--muted-foreground)" }}>
            Until approval is complete, channel playback remains disabled.
          </p>
          <form action="/api/client/auth/logout" method="post">
            <button
              type="submit"
              style={{
                border: "1px solid var(--border)",
                borderRadius: "10px",
                padding: "10px 14px",
                fontWeight: 600,
                background: "var(--card)",
                color: "var(--foreground)",
                cursor: "pointer",
              }}
            >
              Logout
            </button>
          </form>
        </section>
      </main>
    );
  }

  const data = await getHomeIptvData();
  const admin = getSupabaseAdmin();

  const [{ data: stateRow }, { data: favoriteRows }] = await Promise.all([
    admin
      .from("client_state")
      .select("favorites,recent,last_channel_id,theme,cookie_prefs")
      .eq("user_id", current.user.id)
      .maybeSingle(),
    admin
      .from("client_favorites")
      .select("channel_id")
      .eq("user_id", current.user.id)
      .order("created_at", { ascending: false }),
  ]);

  const favoriteIdsFromTable = Array.isArray(favoriteRows)
    ? favoriteRows.map((row) => String(row?.channel_id || "")).filter(Boolean)
    : [];
  const initialFavorites = favoriteIdsFromTable.length
    ? favoriteIdsFromTable
    : (Array.isArray(stateRow?.favorites) ? stateRow.favorites.map((x) => String(x || "")).filter(Boolean) : []);

  return (
    <IptvHomeClient
      initialChannels={data.channels}
      initialCategories={data.categories}
      initialClientState={{
        favorites: initialFavorites,
        recent: Array.isArray(stateRow?.recent) ? stateRow.recent : [],
        lastChannelId: String(stateRow?.last_channel_id || ""),
        theme: String(stateRow?.theme || ""),
        cookiePrefs: stateRow?.cookie_prefs && typeof stateRow.cookie_prefs === "object" ? stateRow.cookie_prefs : {},
      }}
      currentClient={{
        email: String(current.client.email || ""),
        fullName: String(current.client.full_name || ""),
        mobileNumber: String(current.client.mobile_number || ""),
        avatarUrl: String(current.client.avatar_url || ""),
      }}
    />
  );
}
