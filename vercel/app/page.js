import IptvHomeClient from "../components/iptv/IptvHomeClient";
import { getHomeIptvData } from "../components/iptv/homeData";
import { requireClient } from "../lib/clientAuth";
import { getSupabaseAdmin } from "../lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const current = await requireClient();
  const data = await getHomeIptvData();
  const admin = getSupabaseAdmin();

  const { data: stateRow } = await admin
    .from("client_state")
    .select("favorites,recent,last_channel_id,theme,cookie_prefs")
    .eq("user_id", current.user.id)
    .maybeSingle();

  return (
    <IptvHomeClient
      initialChannels={data.channels}
      initialCategories={data.categories}
      initialClientState={{
        favorites: Array.isArray(stateRow?.favorites) ? stateRow.favorites : [],
        recent: Array.isArray(stateRow?.recent) ? stateRow.recent : [],
        lastChannelId: String(stateRow?.last_channel_id || ""),
        theme: String(stateRow?.theme || ""),
        cookiePrefs: stateRow?.cookie_prefs && typeof stateRow.cookie_prefs === "object" ? stateRow.cookie_prefs : {},
      }}
      currentClient={{
        email: String(current.client.email || ""),
        fullName: String(current.client.full_name || ""),
        mobileNumber: String(current.client.mobile_number || ""),
      }}
    />
  );
}
