import { getSupabaseAdmin } from "./supabaseAdmin";

const ACTIVITY_EVENTS = new Set([
  "presence_ping",
  "channel_select",
  "favorite_toggle",
  "theme_change",
  "sidebar_toggle",
  "cookie_consent",
]);

function safeDate(value) {
  const d = new Date(value || "");
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function getActiveViewerSnapshot({ activeWindowSeconds = 180, lookbackHours = 24 } = {}) {
  const admin = getSupabaseAdmin();
  const now = new Date();
  const activeCutoff = new Date(now.getTime() - activeWindowSeconds * 1000);
  const lookback = new Date(now.getTime() - lookbackHours * 60 * 60 * 1000);

  const { data: users } = await admin
    .from("client_users")
    .select("user_id,email,full_name,mobile_number,is_active")
    .eq("is_active", true);

  const activeUsers = Array.isArray(users) ? users : [];
  if (!activeUsers.length) {
    return { count: 0, viewers: [], generated_at: now.toISOString() };
  }

  const userIds = activeUsers.map((u) => String(u.user_id || "")).filter(Boolean);
  const { data: events } = await admin
    .from("client_activity_events")
    .select("user_id,event_type,event_data,created_at")
    .in("user_id", userIds)
    .in("event_type", [...ACTIVITY_EVENTS, "client_login"])
    .gte("created_at", lookback.toISOString())
    .order("created_at", { ascending: false })
    .limit(10000);

  const byUser = new Map(
    activeUsers.map((u) => [
      String(u.user_id),
      {
        user_id: String(u.user_id),
        email: String(u.email || ""),
        full_name: String(u.full_name || ""),
        mobile_number: String(u.mobile_number || ""),
        last_seen_at: "",
        session_started_at: "",
        current_channel_name: "",
        current_channel_id: "",
      },
    ])
  );

  for (const evt of Array.isArray(events) ? events : []) {
    const userId = String(evt?.user_id || "");
    if (!userId || !byUser.has(userId)) continue;
    const row = byUser.get(userId);
    const type = String(evt?.event_type || "");
    const createdAt = String(evt?.created_at || "");
    const data = evt?.event_data && typeof evt.event_data === "object" ? evt.event_data : {};

    if (ACTIVITY_EVENTS.has(type) && !row.last_seen_at) row.last_seen_at = createdAt;
    if (type === "client_login" && !row.session_started_at) row.session_started_at = createdAt;

    if (!row.current_channel_name && (type === "channel_select" || type === "presence_ping")) {
      const cName = String(data?.channel_name || "").trim();
      const cId = String(data?.channel_id || "").trim();
      if (cName) row.current_channel_name = cName;
      if (cId) row.current_channel_id = cId;
    }
  }

  const viewers = [];
  for (const row of byUser.values()) {
    const lastSeen = safeDate(row.last_seen_at);
    if (!lastSeen || lastSeen < activeCutoff) continue;

    const sessionStart = safeDate(row.session_started_at) || lastSeen;
    const activeForSeconds = Math.max(0, Math.floor((now.getTime() - sessionStart.getTime()) / 1000));

    viewers.push({
      ...row,
      active_for_seconds: activeForSeconds,
      active_since_at: sessionStart.toISOString(),
      last_seen_at: lastSeen.toISOString(),
    });
  }

  viewers.sort((a, b) => b.active_for_seconds - a.active_for_seconds);
  return { count: viewers.length, viewers, generated_at: now.toISOString() };
}
