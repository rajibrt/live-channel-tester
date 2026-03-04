import { NextResponse } from "next/server";
import { requireClientApi } from "../../../../lib/clientApi";
import { buildClientMetaFromRequest } from "../../../../lib/requestClientMeta";
import { getSupabaseAdmin } from "../../../../lib/supabaseAdmin";

const ALLOWED_EVENTS = new Set([
  "channel_select",
  "playback_attempt",
  "playback_failed",
  "favorite_toggle",
  "theme_change",
  "sidebar_toggle",
  "cookie_consent",
  "presence_ping",
  "module_switch",
  "movie_select",
  "movie_playback_attempt",
  "movie_playback_failed",
  "movie_progress",
  "movie_complete",
  "movie_favorite_toggle",
]);

export async function POST(request) {
  const auth = await requireClientApi();
  if (!auth.ok) return auth.response;

  const payload = await request.json().catch(() => ({}));
  const eventType = String(payload?.event_type || "").trim();
  const eventData = payload?.event_data && typeof payload.event_data === "object" ? payload.event_data : {};
  const requestMeta = buildClientMetaFromRequest(request);
  const mergedEventData = {
    ...requestMeta,
    ...eventData,
    device_key: String(eventData?.device_key || requestMeta.device_key || "").trim(),
  };

  if (!ALLOWED_EVENTS.has(eventType)) {
    return NextResponse.json({ error: "Unsupported event_type" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  await admin.from("client_activity_events").insert({
    user_id: auth.current.user.id,
    event_type: eventType,
    event_data: mergedEventData,
  });

  return NextResponse.json({ ok: true });
}
