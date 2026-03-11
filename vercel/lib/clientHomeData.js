import { getHomeIptvData } from "../components/iptv/homeData";
import { getMoviesCatalogForUser } from "./moviesData";
import { getSupabaseAdmin } from "./supabaseAdmin";

export async function getClientHomeData(userId, options = {}) {
  const includeMovies = options?.includeMovies === true;
  const [data, movieData] = await Promise.all([
    getHomeIptvData(),
    includeMovies ? getMoviesCatalogForUser(userId) : Promise.resolve(null),
  ]);
  const admin = getSupabaseAdmin();

  const [{ data: stateRow }, { data: favoriteRows }, { data: recentRows }] = await Promise.all([
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
    admin
      .from("client_recent_history")
      .select("channel_id,watched_at,id,source")
      .eq("user_id", userId)
      .order("watched_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(100),
  ]);

  const favoriteIdsFromTable = Array.isArray(favoriteRows)
    ? favoriteRows.map((row) => String(row?.channel_id || "")).filter(Boolean)
    : [];

  const initialFavorites = favoriteIdsFromTable.length
    ? favoriteIdsFromTable
    : (Array.isArray(stateRow?.favorites) ? stateRow.favorites.map((x) => String(x || "")).filter(Boolean) : []);

  const initialRecentFromHistory = (() => {
    const seen = new Set();
    const out = [];
    for (const row of Array.isArray(recentRows) ? recentRows : []) {
      const channelId = String(row?.channel_id || "").trim();
      if (!channelId || seen.has(channelId)) continue;
      seen.add(channelId);
      out.push(channelId);
      if (out.length >= 30) break;
    }
    return out;
  })();

  return {
    channels: data.channels,
    categories: data.categories,
    movies: movieData?.movies || [],
    movieCategories: movieData?.categories || [],
    continueWatching: movieData?.continueWatching || [],
    initialClientState: {
      favorites: initialFavorites,
      recent: initialRecentFromHistory.length
        ? initialRecentFromHistory
        : (Array.isArray(stateRow?.recent) ? stateRow.recent : []),
      lastChannelId: String(stateRow?.last_channel_id || ""),
      theme: String(stateRow?.theme || ""),
      cookiePrefs: stateRow?.cookie_prefs && typeof stateRow.cookie_prefs === "object" ? stateRow.cookie_prefs : {},
    },
  };
}
