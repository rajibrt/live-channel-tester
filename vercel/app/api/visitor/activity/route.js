import { NextResponse } from "next/server";
import { getCurrentClient } from "../../../../lib/clientAuth";
import { buildClientMetaFromRequest } from "../../../../lib/requestClientMeta";
import { getSupabaseAdmin } from "../../../../lib/supabaseAdmin";

const ALLOWED_EVENTS = new Set([
  "page_view",
  "presence_ping",
  "channel_select",
  "playback_attempt",
  "playback_failed",
  "watch_session",
  "module_switch",
  "movie_select",
  "movie_playback_attempt",
  "movie_playback_failed",
  "movie_complete",
  "favorite_toggle",
  "theme_change",
  "cookie_consent",
]);

function isMissingAnalyticsTableError(error) {
  const message = String(error?.message || "").toLowerCase();
  const code = String(error?.code || "").trim();
  return code === "42P01" || message.includes("viewer_activity_events") || message.includes("schema cache");
}

function cleanEventData(value) {
  const raw = value && typeof value === "object" ? value : {};
  const json = JSON.stringify(raw);
  if (json.length <= 6000) return raw;
  return {
    truncated: true,
    route: String(raw.route || "").slice(0, 120),
    channel_id: String(raw.channel_id || "").slice(0, 120),
    channel_name: String(raw.channel_name || "").slice(0, 180),
    movie_id: String(raw.movie_id || "").slice(0, 120),
    movie_title: String(raw.movie_title || "").slice(0, 180),
    watch_seconds: Math.max(0, Number(raw.watch_seconds || 0) || 0),
  };
}

export async function POST(request) {
  const payload = await request.json().catch(() => ({}));
  const eventType = String(payload?.event_type || "").trim();
  if (!ALLOWED_EVENTS.has(eventType)) {
    return NextResponse.json({ error: "Unsupported event_type" }, { status: 400 });
  }

  const current = await getCurrentClient().catch(() => null);
  const requestMeta = buildClientMetaFromRequest(request);
  const eventData = cleanEventData(payload?.event_data);
  const mergedEventData = {
    ...requestMeta,
    ...eventData,
    route: String(eventData?.route || requestMeta?.route || "").slice(0, 180),
    device_key: String(eventData?.device_key || requestMeta.device_key || "").trim(),
  };

  const viewerType = current?.user?.id ? "client" : "guest";
  const viewerKey = viewerType === "client"
    ? String(current.user.id)
    : String(mergedEventData.device_key || requestMeta.device_key || "").trim();

  if (!viewerKey) {
    return NextResponse.json({ error: "Missing viewer key" }, { status: 400 });
  }

  let error = null;
  try {
    const admin = getSupabaseAdmin();
    ({ error } = await admin.from("viewer_activity_events").insert({
      viewer_type: viewerType,
      viewer_key: viewerKey,
      user_id: current?.user?.id || null,
      event_type: eventType,
      event_data: mergedEventData,
    }));
  } catch (err) {
    error = err;
  }

  if (error) {
    if (isMissingAnalyticsTableError(error)) {
      return NextResponse.json({ ok: true, analytics_saved: false, analytics_setup_required: true }, { status: 202 });
    }
    return NextResponse.json({ error: error.message || "Failed to save visitor event." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
