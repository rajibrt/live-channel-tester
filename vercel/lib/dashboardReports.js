import { getSupabaseAdmin } from "./supabaseAdmin";

function safeDate(value) {
  const date = new Date(value || "");
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeKey(value) {
  return String(value || "").trim().toLowerCase();
}

function extractDeviceKey(eventData) {
  if (!eventData || typeof eventData !== "object") return "";
  const direct = String(eventData.device_key || "").trim();
  if (direct) return direct;

  const ua = normalizeKey(eventData.user_agent || eventData.ua || "");
  const platform = normalizeKey(eventData.device_platform || eventData.platform || "");
  if (!ua) return "";
  return `ua:${ua.slice(0, 64)}|p:${platform.slice(0, 32)}`;
}

function sumWatchSeconds(rows) {
  return rows.reduce((sum, row) => sum + Math.max(0, Number(row?.watch_seconds || 0)), 0);
}

function startOfHour(date) {
  const d = new Date(date);
  d.setMinutes(0, 0, 0);
  return d;
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfMonth(date) {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function buildBuckets({ count, stepMs, start, labelFormatter }) {
  const out = [];
  for (let i = 0; i < count; i += 1) {
    const at = new Date(start.getTime() + i * stepMs);
    out.push({
      key: at.toISOString(),
      label: labelFormatter(at),
      value: 0,
    });
  }
  return out;
}

function addToBucketMap(buckets, keyFn, rows) {
  const map = new Map(buckets.map((b, i) => [b.key, i]));
  for (const row of rows) {
    const at = safeDate(row?.created_at);
    if (!at) continue;
    const key = keyFn(at).toISOString();
    const idx = map.get(key);
    if (typeof idx === "number") buckets[idx].value += 1;
  }
}

export async function getDashboardReports() {
  const admin = getSupabaseAdmin();
  const now = new Date();
  const cutoff24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const cutoff7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const cutoff30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const cutoff365d = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

  const [{ data: events }, { data: history }, { data: users }, { data: loginEventsTrend }] = await Promise.all([
    admin
      .from("client_activity_events")
      .select("user_id,event_type,event_data,created_at")
      .gte("created_at", cutoff7d.toISOString())
      .order("created_at", { ascending: false })
      .limit(50000),
    admin
      .from("client_recent_history")
      .select("user_id,channel_id,channel_name,watch_seconds,watched_at,source")
      .gte("watched_at", cutoff7d.toISOString())
      .order("watched_at", { ascending: false })
      .limit(50000),
    admin
      .from("client_users")
      .select("user_id,approval_status,auth_provider,created_at,is_active"),
    admin
      .from("client_activity_events")
      .select("created_at,event_type")
      .eq("event_type", "client_login")
      .gte("created_at", cutoff365d.toISOString())
      .order("created_at", { ascending: true })
      .limit(200000),
  ]);

  const eventRows = Array.isArray(events) ? events : [];
  const historyRows = (Array.isArray(history) ? history : []).filter((row) => String(row?.source || "") !== "sync");
  const userRows = Array.isArray(users) ? users : [];
  const loginTrendRows = Array.isArray(loginEventsTrend) ? loginEventsTrend : [];

  const sessionEvents = eventRows.filter((row) => String(row?.event_type || "") === "client_login");
  const playbackAttempts7d = eventRows.filter((row) => String(row?.event_type || "") === "playback_attempt");
  const playbackFails7d = eventRows.filter((row) => String(row?.event_type || "") === "playback_failed");
  const playbackFails24h = playbackFails7d.filter((row) => {
    const at = safeDate(row?.created_at);
    return at && at >= cutoff24h;
  });
  const sessions24 = sessionEvents.filter((row) => {
    const at = safeDate(row?.created_at);
    return at && at >= cutoff24h;
  });

  const devices24 = new Set();
  const devicesBefore24 = new Set();
  const loginMethod24 = new Map();
  const sessionsByUser7d = new Map();
  for (const row of sessionEvents) {
    const at = safeDate(row?.created_at);
    if (!at) continue;
    const userId = String(row?.user_id || "").trim();
    if (userId) {
      sessionsByUser7d.set(userId, (sessionsByUser7d.get(userId) || 0) + 1);
    }

    const eventData = row?.event_data && typeof row.event_data === "object" ? row.event_data : {};
    const method = String(eventData?.via || "unknown").trim() || "unknown";
    if (at >= cutoff24h) {
      const key = extractDeviceKey(eventData);
      if (key) devices24.add(key);
      loginMethod24.set(method, (loginMethod24.get(method) || 0) + 1);
    } else {
      const key = extractDeviceKey(eventData);
      if (key) devicesBefore24.add(key);
    }
  }

  const activeUsers24Set = new Set();
  for (const row of eventRows) {
    const at = safeDate(row?.created_at);
    const userId = String(row?.user_id || "").trim();
    if (at && at >= cutoff24h && userId) activeUsers24Set.add(userId);
  }
  for (const row of historyRows) {
    const at = safeDate(row?.watched_at);
    const userId = String(row?.user_id || "").trim();
    if (at && at >= cutoff24h && userId) activeUsers24Set.add(userId);
  }

  const watch24 = historyRows.filter((row) => {
    const at = safeDate(row?.watched_at);
    return at && at >= cutoff24h;
  });
  const watchSeconds24 = sumWatchSeconds(watch24);
  const watchSessions24 = watch24.filter((row) => Number(row?.watch_seconds || 0) > 0).length;
  const uniqueChannels24 = new Set(
    watch24
      .map((row) => String(row?.channel_id || "").trim())
      .filter(Boolean)
  );

  const channelAgg = new Map();
  for (const row of historyRows) {
    const channelId = String(row?.channel_id || "").trim();
    if (!channelId) continue;
    const key = channelId;
    if (!channelAgg.has(key)) {
      channelAgg.set(key, {
        channel_id: channelId,
        channel_name: String(row?.channel_name || "Unknown"),
        watch_seconds: 0,
        views: 0,
      });
    }
    const item = channelAgg.get(key);
    item.watch_seconds += Math.max(0, Number(row?.watch_seconds || 0));
    item.views += 1;
    if (!item.channel_name || item.channel_name === "Unknown") {
      item.channel_name = String(row?.channel_name || item.channel_name || "Unknown");
    }
  }

  const topChannels7d = [...channelAgg.values()]
    .sort((a, b) => b.watch_seconds - a.watch_seconds)
    .slice(0, 8);

  const playbackAgg = new Map();
  const ensurePlaybackRow = (channelId, channelName) => {
    const safeId = String(channelId || "").trim() || "unknown";
    if (!playbackAgg.has(safeId)) {
      playbackAgg.set(safeId, {
        channel_id: safeId,
        channel_name: String(channelName || "").trim() || safeId,
        attempts: 0,
        failures: 0,
        last_failed_at: null,
      });
    }
    return playbackAgg.get(safeId);
  };

  for (const row of playbackAttempts7d) {
    const eventData = row?.event_data && typeof row.event_data === "object" ? row.event_data : {};
    const item = ensurePlaybackRow(eventData?.channel_id, eventData?.channel_name);
    item.attempts += 1;
  }

  for (const row of playbackFails7d) {
    const eventData = row?.event_data && typeof row.event_data === "object" ? row.event_data : {};
    const item = ensurePlaybackRow(eventData?.channel_id, eventData?.channel_name);
    item.failures += 1;
    const failedAt = safeDate(row?.created_at);
    if (failedAt) {
      if (!item.last_failed_at) item.last_failed_at = failedAt.toISOString();
      else item.last_failed_at = new Date(Math.max(new Date(item.last_failed_at).getTime(), failedAt.getTime())).toISOString();
    }
  }

  const topPlaybackFailures7d = [...playbackAgg.values()]
    .filter((item) => item.failures > 0)
    .map((item) => ({
      ...item,
      failure_rate_pct:
        item.attempts > 0 ? Math.round((item.failures / item.attempts) * 100) : 100,
    }))
    .sort((a, b) => {
      if (b.failures !== a.failures) return b.failures - a.failures;
      return b.failure_rate_pct - a.failure_rate_pct;
    })
    .slice(0, 10);

  const hourMs = 60 * 60 * 1000;
  const dayMs = 24 * hourMs;
  const dayStart = startOfHour(new Date(now.getTime() - 23 * hourMs));
  const weekStart = startOfDay(new Date(now.getTime() - 6 * dayMs));
  const monthStart = startOfDay(new Date(now.getTime() - 29 * dayMs));
  const yearStart = startOfMonth(new Date(now.getFullYear(), now.getMonth() - 11, 1));

  const dayBuckets = buildBuckets({
    count: 24,
    stepMs: hourMs,
    start: dayStart,
    labelFormatter: (d) => `${String(d.getHours()).padStart(2, "0")}:00`,
  });
  const weekBuckets = buildBuckets({
    count: 7,
    stepMs: dayMs,
    start: weekStart,
    labelFormatter: (d) =>
      d.toLocaleDateString("en-US", {
        weekday: "short",
      }),
  });
  const monthBuckets = buildBuckets({
    count: 30,
    stepMs: dayMs,
    start: monthStart,
    labelFormatter: (d) =>
      d.toLocaleDateString("en-US", {
        day: "2-digit",
        month: "short",
      }),
  });
  const yearBuckets = buildBuckets({
    count: 12,
    stepMs: dayMs * 31,
    start: yearStart,
    labelFormatter: (d) =>
      d.toLocaleDateString("en-US", {
        month: "short",
      }),
  }).map((bucket, idx) => {
    const d = new Date(yearStart);
    d.setMonth(d.getMonth() + idx);
    return {
      ...bucket,
      key: d.toISOString(),
      label: d.toLocaleDateString("en-US", { month: "short" }),
      value: 0,
    };
  });

  addToBucketMap(dayBuckets, (at) => startOfHour(at), loginTrendRows.filter((r) => safeDate(r?.created_at) >= cutoff24h));
  addToBucketMap(weekBuckets, (at) => startOfDay(at), loginTrendRows.filter((r) => safeDate(r?.created_at) >= cutoff7d));
  addToBucketMap(monthBuckets, (at) => startOfDay(at), loginTrendRows.filter((r) => safeDate(r?.created_at) >= cutoff30d));
  addToBucketMap(
    yearBuckets,
    (at) => startOfMonth(at),
    loginTrendRows.filter((r) => safeDate(r?.created_at) >= cutoff365d)
  );

  const newDeviceCount24 = [...devices24].filter((key) => !devicesBefore24.has(key)).length;
  const returningViewers7d = [...sessionsByUser7d.values()].filter((count) => count >= 2).length;

  const pendingApprovals = userRows.filter((row) => String(row?.approval_status || "").toLowerCase() === "pending").length;
  const approvedUsers = userRows.filter((row) => String(row?.approval_status || "").toLowerCase() === "approved").length;
  const facebookUsers = userRows.filter((row) => String(row?.auth_provider || "").toLowerCase() === "facebook").length;
  const newUsers7d = userRows.filter((row) => {
    const created = safeDate(row?.created_at);
    return created && created >= cutoff7d;
  }).length;

  return {
    generated_at: now.toISOString(),
    sessions_24h: sessions24.length,
    sessions_7d: sessionEvents.length,
    active_users_24h: activeUsers24Set.size,
    known_devices_24h: devices24.size,
    new_devices_24h: newDeviceCount24,
    returning_viewers_7d: returningViewers7d,
    watch_seconds_24h: watchSeconds24,
    watch_sessions_24h: watchSessions24,
    avg_watch_seconds_per_session_24h: watchSessions24 > 0 ? Math.round(watchSeconds24 / watchSessions24) : 0,
    unique_channels_24h: uniqueChannels24.size,
    pending_approvals: pendingApprovals,
    approved_users: approvedUsers,
    facebook_users: facebookUsers,
    new_users_7d: newUsers7d,
    playback_failures_24h: playbackFails24h.length,
    playback_failures_7d: playbackFails7d.length,
    playback_attempts_7d: playbackAttempts7d.length,
    top_playback_failures_7d: topPlaybackFailures7d,
    login_methods_24h: Object.fromEntries([...loginMethod24.entries()].sort((a, b) => b[1] - a[1])),
    top_channels_7d: topChannels7d,
    user_login_trend: {
      day: dayBuckets,
      week: weekBuckets,
      month: monthBuckets,
      year: yearBuckets,
    },
  };
}
