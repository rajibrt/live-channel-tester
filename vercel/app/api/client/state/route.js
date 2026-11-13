import { NextResponse } from "next/server";
import { requireClientApi } from "../../../../lib/clientApi";
import { getSupabaseAdmin } from "../../../../lib/supabaseAdmin";

function toStringArray(value, limit = 100) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const item of value) {
    const v = String(item || "").trim();
    if (!v) continue;
    out.push(v);
    if (out.length >= limit) break;
  }
  return out;
}

function normalizeTheme(value) {
  const v = String(value || "").trim().toLowerCase();
  return v === "light" ? "light" : "dark";
}

function normalizeCookiePrefs(value) {
  const raw = value && typeof value === "object" ? value : {};
  const consent = String(raw?.consent || "").toLowerCase();
  const language = String(raw?.language || "").toLowerCase();
  return {
    consent: consent === "accepted" || consent === "declined" ? consent : "unknown",
    language: language === "bn" ? "bn" : "en",
  };
}

export async function GET() {
  const auth = await requireClientApi();
  if (!auth.ok) return auth.response;

  const admin = getSupabaseAdmin();
  const userId = auth.current.user.id;
  const [{ data: stateData }, { data: favoriteRows }, { data: recentRows }] = await Promise.all([
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

  const favoriteIdsFromTable = Array.isArray(favoriteRows) ? favoriteRows.map((row) => String(row?.channel_id || "")) : [];
  const effectiveFavorites = favoriteIdsFromTable.length
    ? toStringArray(favoriteIdsFromTable, 200)
    : toStringArray(stateData?.favorites, 200);
  const effectiveRecentFromHistory = (() => {
    const seen = new Set();
    const out = [];
    for (const row of Array.isArray(recentRows) ? recentRows : []) {
      const channelId = String(row?.channel_id || "").trim();
      if (!channelId || seen.has(channelId)) continue;
      seen.add(channelId);
      out.push(channelId);
      if (out.length >= 200) break;
    }
    return out;
  })();

  return NextResponse.json({
    favorites: effectiveFavorites,
    recent: effectiveRecentFromHistory.length ? effectiveRecentFromHistory : toStringArray(stateData?.recent, 200),
    last_channel_id: String(stateData?.last_channel_id || ""),
    theme: normalizeTheme(stateData?.theme),
    cookie_prefs: normalizeCookiePrefs(stateData?.cookie_prefs),
  });
}

export async function POST(request) {
  const auth = await requireClientApi();
  if (!auth.ok) return auth.response;

  const payload = await request.json().catch(() => ({}));
  // Favourites and recent channels are only rewritten when the viewer actually changed them
  // (older clients that do not send the flags are treated as "unchanged"), and then only the
  // difference is applied. A blind full rewrite used to wipe saved favourites whenever a page
  // rendered with an empty list, e.g. while the server restarted during a deploy.
  const favoritesChanged = payload?.favorites_changed === true;
  const recentChanged = payload?.recent_changed === true;
  const favorites = toStringArray(payload?.favorites, 200);
  const recent = toStringArray(payload?.recent, 200);
  const lastChannelId = String(payload?.last_channel_id || "").trim();
  const theme = normalizeTheme(payload?.theme);
  const cookiePrefs = normalizeCookiePrefs(payload?.cookie_prefs);
  const recentAllowed = cookiePrefs.consent === "accepted";
  const userId = auth.current.user.id;

  const admin = getSupabaseAdmin();
  const now = new Date().toISOString();

  const stateRow = { user_id: userId, theme, cookie_prefs: cookiePrefs, updated_at: now };
  if (favoritesChanged) stateRow.favorites = favorites;
  if (recentAllowed && recentChanged) stateRow.recent = recent;
  if (recentAllowed && lastChannelId) stateRow.last_channel_id = lastChannelId;
  const { error: stateErr } = await admin.from("client_state").upsert(stateRow, { onConflict: "user_id" });
  if (stateErr) {
    return NextResponse.json({ error: stateErr.message || "Failed to save client state" }, { status: 500 });
  }

  if (favoritesChanged) {
    const { data: existingRows, error: readErr } = await admin.from("client_favorites").select("channel_id").eq("user_id", userId);
    if (readErr) {
      return NextResponse.json({ error: readErr.message || "Failed to read favorites" }, { status: 500 });
    }
    const existing = new Set((existingRows || []).map((row) => String(row?.channel_id || "")));
    const wanted = new Set(favorites);
    const toRemove = [...existing].filter((id) => id && !wanted.has(id));
    const toAdd = favorites.filter((id) => !existing.has(id));
    if (toRemove.length) {
      const { error } = await admin.from("client_favorites").delete().eq("user_id", userId).in("channel_id", toRemove);
      if (error) return NextResponse.json({ error: error.message || "Failed to update favorites" }, { status: 500 });
    }
    if (toAdd.length) {
      const { error } = await admin
        .from("client_favorites")
        .insert(toAdd.map((channelId) => ({ user_id: userId, channel_id: channelId, channel_name: "" })));
      if (error) return NextResponse.json({ error: error.message || "Failed to store favorites" }, { status: 500 });
    }
  }

  if (recentAllowed && recentChanged && recent.length) {
    const { error: deleteRecentErr } = await admin.from("client_recent_history").delete().eq("user_id", userId).eq("source", "sync");
    if (deleteRecentErr) {
      return NextResponse.json({ error: deleteRecentErr.message || "Failed to update recent history" }, { status: 500 });
    }
    const { error: recentInsertErr } = await admin.from("client_recent_history").insert(
      recent.slice(0, 30).map((channelId) => ({ user_id: userId, channel_id: channelId, channel_name: "", source: "sync" }))
    );
    if (recentInsertErr) {
      return NextResponse.json({ error: recentInsertErr.message || "Failed to store recent history" }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
