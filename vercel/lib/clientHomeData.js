import { getHomeIptvData } from "../components/iptv/homeData";
import { getSupabaseAdmin } from "./supabaseAdmin";

export async function getClientHomeData(userId) {
  const data = await getHomeIptvData();
  const admin = getSupabaseAdmin();

  const [{ data: stateRow }, { data: favoriteRows }] = await Promise.all([
    admin
      .from("client_state")
      .select("favorites,recent,last_channel_id,theme,cookie_prefs")
      .eq("user_id", userId)
      .maybeSingle(),
    admin
      .from("client_favorites")
      .select("channel_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
  ]);

  const favoriteIdsFromTable = Array.isArray(favoriteRows)
    ? favoriteRows.map((row) => String(row?.channel_id || "")).filter(Boolean)
    : [];

  const initialFavorites = favoriteIdsFromTable.length
    ? favoriteIdsFromTable
    : (Array.isArray(stateRow?.favorites) ? stateRow.favorites.map((x) => String(x || "")).filter(Boolean) : []);

  return {
    channels: data.channels,
    categories: data.categories,
    initialClientState: {
      favorites: initialFavorites,
      recent: Array.isArray(stateRow?.recent) ? stateRow.recent : [],
      lastChannelId: String(stateRow?.last_channel_id || ""),
      theme: String(stateRow?.theme || ""),
      cookiePrefs: stateRow?.cookie_prefs && typeof stateRow.cookie_prefs === "object" ? stateRow.cookie_prefs : {},
    },
  };
}
