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

function uniqueViewerCount(rows, type = "") {
  const seen = new Set();
  for (const row of Array.isArray(rows) ? rows : []) {
    if (type && String(row?.viewer_type || "") !== type) continue;
    const key = String(row?.viewer_key || row?.user_id || "").trim();
    if (key) seen.add(key);
  }
  return seen.size;
}

export async function getDashboardReports() {
  const admin = getSupabaseAdmin();
  const now = new Date();
  const cutoff24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const cutoff7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const cutoff30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const cutoff365d = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

  const [
    { data: events },
    { data: history },
    { data: users },
    viewerActivityResult,
    { data: visitorEventsTrend },
    { data: visitorHistoryTrend },
    { count: totalSessionsCount },
    { count: totalPlaybackAttemptsCount },
    { count: totalPlaybackFailuresCount },
    { count: totalWatchSessionsCount },
  ] = await Promise.all([
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
      .from("viewer_activity_events")
      .select("viewer_type,viewer_key,user_id,event_type,event_data,created_at")
      .gte("created_at", cutoff365d.toISOString())
      .order("created_at", { ascending: true })
      .limit(250000),
    admin
      .from("client_activity_events")
      .select("user_id,created_at,event_type")
      .gte("created_at", cutoff365d.toISOString())
      .order("created_at", { ascending: true })
      .limit(200000),
    admin
      .from("client_recent_history")
      .select("user_id,watched_at,source")
      .gte("watched_at", cutoff365d.toISOString())
      .order("watched_at", { ascending: true })
      .limit(200000),
    admin
      .from("client_activity_events")
      .select("id", { count: "exact", head: true })
      .eq("event_type", "client_login"),
    admin
      .from("client_activity_events")
      .select("id", { count: "exact", head: true })
      .eq("event_type", "playback_attempt"),
    admin
      .from("client_activity_events")
      .select("id", { count: "exact", head: true })
      .eq("event_type", "playback_failed"),
    admin
      .from("client_recent_history")
      .select("id", { count: "exact", head: true })
      .neq("source", "sync"),
  ]);

  const eventRows = Array.isArray(events) ? events : [];
  const historyRows = (Array.isArray(history) ? history : []).filter((row) => String(row?.source || "") !== "sync");
  const userRows = Array.isArray(users) ? users : [];
  const viewerActivityRows = !viewerActivityResult?.error && Array.isArray(viewerActivityResult?.data)
    ? viewerActivityResult.data
    : [];
  const visitorTrendRows = Array.isArray(visitorEventsTrend) ? visitorEventsTrend : [];
  const visitorHistoryRows = (Array.isArray(visitorHistoryTrend) ? visitorHistoryTrend : []).filter(
    (row) => String(row?.source || "") !== "sync"
  );

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

  const viewerRows7d = viewerActivityRows.filter((row) => {
    const at = safeDate(row?.created_at);
    return at && at >= cutoff7d;
  });
  const viewerRows24h = viewerActivityRows.filter((row) => {
    const at = safeDate(row?.created_at);
    return at && at >= cutoff24h;
  });
  const guestRows24h = viewerRows24h.filter((row) => String(row?.viewer_type || "") === "guest");
  const clientViewerRows24h = viewerRows24h.filter((row) => String(row?.viewer_type || "") === "client");
  const guestRows7d = viewerRows7d.filter((row) => String(row?.viewer_type || "") === "guest");
  const clientViewerRows7d = viewerRows7d.filter((row) => String(row?.viewer_type || "") === "client");
  const guestWatch24h = guestRows24h.filter((row) => String(row?.event_type || "") === "watch_session");
  const clientWatch24h = clientViewerRows24h.filter((row) => String(row?.event_type || "") === "watch_session");
  const guestWatchSeconds24h = guestWatch24h.reduce((sum, row) => {
    const data = row?.event_data && typeof row.event_data === "object" ? row.event_data : {};
    return sum + Math.max(0, Number(data?.watch_seconds || 0));
  }, 0);
  const clientTrackedWatchSeconds24h = clientWatch24h.reduce((sum, row) => {
    const data = row?.event_data && typeof row.event_data === "object" ? row.event_data : {};
    return sum + Math.max(0, Number(data?.watch_seconds || 0));
  }, 0);
  const viewerChannelAgg = new Map();
  for (const row of viewerRows7d) {
    const type = String(row?.event_type || "");
    if (!["channel_select", "presence_ping", "playback_attempt", "watch_session"].includes(type)) continue;
    const data = row?.event_data && typeof row.event_data === "object" ? row.event_data : {};
    const channelId = String(data?.channel_id || "").trim();
    if (!channelId) continue;
    if (!viewerChannelAgg.has(channelId)) {
      viewerChannelAgg.set(channelId, {
        channel_id: channelId,
        channel_name: String(data?.channel_name || channelId),
        guest_viewers: new Set(),
        client_viewers: new Set(),
        events: 0,
        watch_seconds: 0,
      });
    }
    const item = viewerChannelAgg.get(channelId);
    const viewerKey = String(row?.viewer_key || row?.user_id || "").trim();
    if (String(row?.viewer_type || "") === "guest" && viewerKey) item.guest_viewers.add(viewerKey);
    if (String(row?.viewer_type || "") === "client" && viewerKey) item.client_viewers.add(viewerKey);
    item.events += 1;
    item.watch_seconds += Math.max(0, Number(data?.watch_seconds || 0));
    if (!item.channel_name || item.channel_name === channelId) item.channel_name = String(data?.channel_name || item.channel_name || channelId);
  }
  const topViewerChannels7d = [...viewerChannelAgg.values()]
    .map((item) => ({
      channel_id: item.channel_id,
      channel_name: item.channel_name,
      guest_viewers: item.guest_viewers.size,
      client_viewers: item.client_viewers.size,
      total_viewers: item.guest_viewers.size + item.client_viewers.size,
      events: item.events,
      watch_seconds: item.watch_seconds,
    }))
    .sort((a, b) => {
      if (b.total_viewers !== a.total_viewers) return b.total_viewers - a.total_viewers;
      return b.events - a.events;
    })
    .slice(0, 10);
  const recentViewerEvents = viewerActivityRows
    .slice()
    .sort((a, b) => new Date(b?.created_at || 0).getTime() - new Date(a?.created_at || 0).getTime())
    .slice(0, 20)
    .map((row) => {
      const data = row?.event_data && typeof row.event_data === "object" ? row.event_data : {};
      return {
        viewer_type: String(row?.viewer_type || "guest"),
        viewer_key: String(row?.viewer_key || "").slice(0, 12),
        event_type: String(row?.event_type || ""),
        route: String(data?.route || ""),
        channel_name: String(data?.channel_name || ""),
        movie_title: String(data?.movie_title || ""),
        watch_seconds: Math.max(0, Number(data?.watch_seconds || 0)),
        created_at: row?.created_at || "",
      };
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

  const visitorEventTypes = new Set(["page_view", "presence_ping", "channel_select", "playback_attempt", "movie_playback_attempt", "client_login"]);
  const relevantEventVisitors = visitorTrendRows.filter((row) => visitorEventTypes.has(String(row?.event_type || "")));
  const relevantHistoryVisitors = visitorHistoryRows.map((row) => ({
    user_id: row?.user_id,
    created_at: row?.watched_at,
  }));
  const relevantVisitors = [...relevantEventVisitors, ...relevantHistoryVisitors];
  const relevantUnifiedViewers = viewerActivityRows
    .filter((row) => visitorEventTypes.has(String(row?.event_type || "")) || String(row?.event_type || "") === "watch_session")
    .map((row) => ({
      ...row,
      user_id: String(row?.viewer_key || row?.user_id || "").trim(),
    }));

  const fillUniqueUserBuckets = (buckets, keyFn, rows) => {
    const bucketUsers = new Map(buckets.map((b) => [b.key, new Set()]));
    for (const row of rows) {
      const at = safeDate(row?.created_at);
      const userId = String(row?.user_id || "").trim();
      if (!at || !userId) continue;
      const key = keyFn(at).toISOString();
      if (!bucketUsers.has(key)) continue;
      bucketUsers.get(key).add(userId);
    }
    for (const bucket of buckets) {
      bucket.value = bucketUsers.get(bucket.key)?.size || 0;
    }
  };

  fillUniqueUserBuckets(dayBuckets, (at) => startOfHour(at), relevantVisitors.filter((r) => safeDate(r?.created_at) >= cutoff24h));
  fillUniqueUserBuckets(weekBuckets, (at) => startOfDay(at), relevantVisitors.filter((r) => safeDate(r?.created_at) >= cutoff7d));
  fillUniqueUserBuckets(monthBuckets, (at) => startOfDay(at), relevantVisitors.filter((r) => safeDate(r?.created_at) >= cutoff30d));
  fillUniqueUserBuckets(yearBuckets, (at) => startOfMonth(at), relevantVisitors.filter((r) => safeDate(r?.created_at) >= cutoff365d));

  const buildViewerBuckets = (sourceRows, filterType = "") => {
    const cloneBuckets = (buckets) => buckets.map((bucket) => ({ ...bucket, value: 0 }));
    const fill = (buckets, keyFn, rows) => {
      const bucketViewers = new Map(buckets.map((b) => [b.key, new Set()]));
      for (const row of rows) {
        if (filterType && String(row?.viewer_type || "") !== filterType) continue;
        const at = safeDate(row?.created_at);
        const viewerKey = String(row?.viewer_key || row?.user_id || "").trim();
        if (!at || !viewerKey) continue;
        const key = keyFn(at).toISOString();
        if (!bucketViewers.has(key)) continue;
        bucketViewers.get(key).add(viewerKey);
      }
      for (const bucket of buckets) {
        bucket.value = bucketViewers.get(bucket.key)?.size || 0;
      }
      return buckets;
    };
    return {
      day: fill(cloneBuckets(dayBuckets), (at) => startOfHour(at), sourceRows.filter((r) => safeDate(r?.created_at) >= cutoff24h)),
      week: fill(cloneBuckets(weekBuckets), (at) => startOfDay(at), sourceRows.filter((r) => safeDate(r?.created_at) >= cutoff7d)),
      month: fill(cloneBuckets(monthBuckets), (at) => startOfDay(at), sourceRows.filter((r) => safeDate(r?.created_at) >= cutoff30d)),
      year: fill(cloneBuckets(yearBuckets), (at) => startOfMonth(at), sourceRows.filter((r) => safeDate(r?.created_at) >= cutoff365d)),
    };
  };

  const unifiedVisitorTrend = viewerActivityRows.length
    ? buildViewerBuckets(relevantUnifiedViewers)
    : { day: dayBuckets, week: weekBuckets, month: monthBuckets, year: yearBuckets };
  const guestVisitorTrend = buildViewerBuckets(relevantUnifiedViewers, "guest");
  const clientViewerTrend = buildViewerBuckets(relevantUnifiedViewers, "client");

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
    total_sessions: Math.max(0, Number(totalSessionsCount || 0)),
    total_playback_attempts: Math.max(0, Number(totalPlaybackAttemptsCount || 0)),
    total_playback_failures: Math.max(0, Number(totalPlaybackFailuresCount || 0)),
    total_watch_sessions: Math.max(0, Number(totalWatchSessionsCount || 0)),
    total_users: userRows.length,
    total_guest_events: viewerActivityRows.filter((row) => String(row?.viewer_type || "") === "guest").length,
    total_client_viewer_events: viewerActivityRows.filter((row) => String(row?.viewer_type || "") === "client").length,
    guest_unique_24h: uniqueViewerCount(guestRows24h, "guest"),
    client_unique_24h: uniqueViewerCount(clientViewerRows24h, "client"),
    total_unique_viewers_24h: uniqueViewerCount(viewerRows24h),
    guest_unique_7d: uniqueViewerCount(guestRows7d, "guest"),
    client_unique_7d: uniqueViewerCount(clientViewerRows7d, "client"),
    total_unique_viewers_7d: uniqueViewerCount(viewerRows7d),
    guest_events_24h: guestRows24h.length,
    client_viewer_events_24h: clientViewerRows24h.length,
    guest_watch_seconds_24h: guestWatchSeconds24h,
    client_tracked_watch_seconds_24h: clientTrackedWatchSeconds24h,
    top_viewer_channels_7d: topViewerChannels7d,
    recent_viewer_events: recentViewerEvents,
    analytics_table_ready: viewerActivityRows.length > 0 || !viewerActivityResult?.error,
    analytics_table_error: viewerActivityResult?.error?.message || "",
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
    visitor_trend: unifiedVisitorTrend,
    guest_visitor_trend: guestVisitorTrend,
    client_viewer_trend: clientViewerTrend,
    user_login_trend: {
      day: dayBuckets,
      week: weekBuckets,
      month: monthBuckets,
      year: yearBuckets,
    },
  };
}
