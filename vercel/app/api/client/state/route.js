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

export async function GET() {
  const auth = await requireClientApi();
  if (!auth.ok) return auth.response;

  const admin = getSupabaseAdmin();
  const userId = auth.current.user.id;
  const { data } = await admin
    .from("client_state")
    .select("favorites,recent,last_channel_id,theme")
    .eq("user_id", userId)
    .maybeSingle();

  return NextResponse.json({
    favorites: toStringArray(data?.favorites, 200),
    recent: toStringArray(data?.recent, 200),
    last_channel_id: String(data?.last_channel_id || ""),
    theme: normalizeTheme(data?.theme),
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
  const userId = auth.current.user.id;

  const admin = getSupabaseAdmin();

  const now = new Date().toISOString();
  await admin.from("client_state").upsert(
    {
      user_id: userId,
      favorites,
      recent,
      last_channel_id: lastChannelId,
      theme,
      updated_at: now,
    },
    { onConflict: "user_id" }
  );

  await admin.from("client_favorites").delete().eq("user_id", userId);
  if (favorites.length) {
    await admin.from("client_favorites").insert(
      favorites.map((channelId) => ({
        user_id: userId,
        channel_id: channelId,
        channel_name: "",
      }))
    );
  }

  await admin.from("client_recent_history").delete().eq("user_id", userId).eq("source", "sync");
  if (recent.length) {
    await admin.from("client_recent_history").insert(
      recent.slice(0, 30).map((channelId) => ({
        user_id: userId,
        channel_id: channelId,
        channel_name: "",
        source: "sync",
      }))
    );
  }

  return NextResponse.json({ ok: true });
}
