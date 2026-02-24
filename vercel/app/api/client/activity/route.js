import { NextResponse } from "next/server";
import { requireClientApi } from "../../../../lib/clientApi";
import { getSupabaseAdmin } from "../../../../lib/supabaseAdmin";

const ALLOWED_EVENTS = new Set([
  "channel_select",
  "favorite_toggle",
  "theme_change",
  "sidebar_toggle",
]);

export async function POST(request) {
  const auth = await requireClientApi();
  if (!auth.ok) return auth.response;

  const payload = await request.json().catch(() => ({}));
  const eventType = String(payload?.event_type || "").trim();
  const eventData = payload?.event_data && typeof payload.event_data === "object" ? payload.event_data : {};

  if (!ALLOWED_EVENTS.has(eventType)) {
    return NextResponse.json({ error: "Unsupported event_type" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  await admin.from("client_activity_events").insert({
    user_id: auth.current.user.id,
    event_type: eventType,
    event_data: eventData,
  });

  return NextResponse.json({ ok: true });
}
