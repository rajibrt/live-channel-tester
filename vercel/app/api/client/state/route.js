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
  const [{ data: stateData }, { data: favoriteRows }] = await Promise.all([
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

  const favoriteIdsFromTable = Array.isArray(favoriteRows) ? favoriteRows.map((row) => String(row?.channel_id || "")) : [];
  const effectiveFavorites = favoriteIdsFromTable.length
    ? toStringArray(favoriteIdsFromTable, 200)
    : toStringArray(stateData?.favorites, 200);

  return NextResponse.json({
    favorites: effectiveFavorites,
    recent: toStringArray(stateData?.recent, 200),
    last_channel_id: String(stateData?.last_channel_id || ""),
    theme: normalizeTheme(stateData?.theme),
    cookie_prefs: normalizeCookiePrefs(stateData?.cookie_prefs),
  });
}

export async function POST(request) {
  const auth = await requireClientApi();
  if (!auth.ok) return auth.response;

  const payload = await request.json().catch(() => ({}));
  const favorites = toStringArray(payload?.favorites, 200);
  const recent = toStringArray(payload?.recent, 200);
  const lastChannelId = String(payload?.last_channel_id || "").trim();
  const theme = normalizeTheme(payload?.theme);
  const cookiePrefs = normalizeCookiePrefs(payload?.cookie_prefs);
  const recentAllowed = cookiePrefs.consent === "accepted";
  const safeRecent = recentAllowed ? recent : [];
  const safeLastChannelId = recentAllowed ? lastChannelId : "";
  const userId = auth.current.user.id;

  const admin = getSupabaseAdmin();

  const now = new Date().toISOString();
  const { error: stateErr } = await admin.from("client_state").upsert(
    {
      user_id: userId,
      favorites,
      recent: safeRecent,
      last_channel_id: safeLastChannelId,
      theme,
      cookie_prefs: cookiePrefs,
      updated_at: now,
    },
    { onConflict: "user_id" }
  );
  if (stateErr) {
    return NextResponse.json({ error: stateErr.message || "Failed to save client state" }, { status: 500 });
  }

  const { error: deleteFavErr } = await admin.from("client_favorites").delete().eq("user_id", userId);
  if (deleteFavErr) {
    return NextResponse.json({ error: deleteFavErr.message || "Failed to update favorites" }, { status: 500 });
  }
  if (favorites.length) {
    const { error: favInsertErr } = await admin.from("client_favorites").insert(
      favorites.map((channelId) => ({
        user_id: userId,
        channel_id: channelId,
        channel_name: "",
      }))
    );
    if (favInsertErr) {
      return NextResponse.json({ error: favInsertErr.message || "Failed to store favorites" }, { status: 500 });
    }
  }

  const { error: deleteRecentErr } = await admin.from("client_recent_history").delete().eq("user_id", userId).eq("source", "sync");
  if (deleteRecentErr) {
    return NextResponse.json({ error: deleteRecentErr.message || "Failed to update recent history" }, { status: 500 });
  }
  if (safeRecent.length) {
    const { error: recentInsertErr } = await admin.from("client_recent_history").insert(
      safeRecent.slice(0, 30).map((channelId) => ({
        user_id: userId,
        channel_id: channelId,
        channel_name: "",
        source: "sync",
      }))
    );
    if (recentInsertErr) {
      return NextResponse.json({ error: recentInsertErr.message || "Failed to store recent history" }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
