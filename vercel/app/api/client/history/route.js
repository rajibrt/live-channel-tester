import { NextResponse } from "next/server";
import { requireClientApi } from "../../../../lib/clientApi";
import { getSupabaseAdmin } from "../../../../lib/supabaseAdmin";

function normalizeChannelText(value) {
  return String(value || "").trim();
}

function normalizeWatchSeconds(value) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds)) return 0;
  return Math.max(0, Math.floor(seconds));
}

export async function POST(request) {
  const auth = await requireClientApi();
  if (!auth.ok) return auth.response;

  const payload = await request.json().catch(() => ({}));
  const channelId = normalizeChannelText(payload?.channel_id);
  const channelName = normalizeChannelText(payload?.channel_name);
  const watchSeconds = normalizeWatchSeconds(payload?.watch_seconds);

  if (!channelId || watchSeconds <= 0) {
    return NextResponse.json({ error: "channel_id and positive watch_seconds are required" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const userId = auth.current.user.id;

  const { error: insertErr } = await admin.from("client_recent_history").insert({
    user_id: userId,
    channel_id: channelId,
    channel_name: channelName,
    watch_seconds: watchSeconds,
    source: "watch",
  });
  if (insertErr) {
    return NextResponse.json({ error: insertErr.message || "Failed to store history" }, { status: 500 });
  }

  const { data: keepRows, error: keepErr } = await admin
    .from("client_recent_history")
    .select("id")
    .eq("user_id", userId)
    .neq("source", "sync")
    .order("watched_at", { ascending: false })
    .limit(50);
  if (keepErr) {
    return NextResponse.json({ error: keepErr.message || "Failed to trim history" }, { status: 500 });
  }

  const keepIds = (keepRows || []).map((row) => Number(row?.id)).filter((id) => Number.isFinite(id));
  if (keepIds.length) {
    const inClause = `(${keepIds.join(",")})`;
    const { error: trimErr } = await admin
      .from("client_recent_history")
      .delete()
      .eq("user_id", userId)
      .neq("source", "sync")
      .not("id", "in", inClause);
    if (trimErr) {
      return NextResponse.json({ error: trimErr.message || "Failed to trim history" }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
