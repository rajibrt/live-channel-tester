import { getSupabaseAdmin } from "./supabaseAdmin";

// Data for the admin Overview (app/dashboard/page.js).
// Sources: client_activity_events (90-day retention + archive totals),
// client_recent_history, client_users, channel_sources / radio_station_sources
// viewer counters, playlists, movies.

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function safeDate(value) {
  const date = new Date(value || "");
  return Number.isNaN(date.getTime()) ? null : date;
}

function inRange(value, from, to) {
  const at = safeDate(value);
  return Boolean(at && at >= from && (!to || at < to));
}

async function fetchAllRows(queryFactory, pageSize = 1000) {
  const rows = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await queryFactory().range(from, from + pageSize - 1);
    if (error) return { data: rows, error };
    const page = Array.isArray(data) ? data : [];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return { data: rows, error: null };
}

async function fetchByIds(admin, table, columns, ids, chunk = 200) {
  const out = [];
  const list = [...new Set(ids.map((id) => String(id)).filter(Boolean))];
  for (let i = 0; i < list.length; i += chunk) {
    const { data } = await admin.from(table).select(columns).in("id", list.slice(i, i + chunk));
    if (Array.isArray(data)) out.push(...data);
  }
  return out;
}

const VISITOR_EVENT_TYPES = ["page_view", "presence_ping", "channel_select", "playback_attempt", "movie_playback_attempt", "client_login"];

function getServerTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

// Unique-visitor counts per bucket from public.dashboard_unique_visitors
// (vercel/supabase/dashboard_performance.sql). Map(bucketIso -> count) or null.
async function fetchUniqueVisitorBuckets(admin, since, unit) {
  const { data, error } = await admin.rpc("dashboard_unique_visitors", {
    p_since: since.toISOString(),
    p_unit: unit,
    p_tz: getServerTimeZone(),
    p_event_types: VISITOR_EVENT_TYPES,
  });
  if (error || !Array.isArray(data)) return null;
  const counts = new Map();
  for (const row of data) {
    const at = safeDate(row?.bucket);
    if (at) counts.set(at.toISOString(), Math.max(0, Number(row?.visitors || 0)));
  }
  return counts;
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

function buildTrendBuckets(now) {
  const day = Array.from({ length: 24 }, (_, i) => {
    const at = new Date(startOfHour(new Date(now.getTime() - 23 * HOUR)).getTime() + i * HOUR);
    return { key: at.toISOString(), label: `${String(at.getHours()).padStart(2, "0")}:00`, value: 0 };
  });
  const daily = (count) => Array.from({ length: count }, (_, i) => {
    const at = startOfDay(new Date(now.getTime() - (count - 1 - i) * DAY));
    return {
      key: at.toISOString(),
      label: count <= 7
        ? at.toLocaleDateString("en-US", { weekday: "short" })
        : at.toLocaleDateString("en-US", { day: "2-digit", month: "short" }),
      value: 0,
    };
  });
  const yearStart = startOfMonth(new Date(now.getFullYear(), now.getMonth() - 11, 1));
  const year = Array.from({ length: 12 }, (_, i) => {
    const at = new Date(yearStart);
    at.setMonth(at.getMonth() + i);
    return { key: at.toISOString(), label: at.toLocaleDateString("en-US", { month: "short" }), value: 0 };
  });
  return { day, week: daily(7), month: daily(30), year };
}

function fillUniqueBuckets(buckets, keyFn, rows) {
  const users = new Map(buckets.map((b) => [b.key, new Set()]));
  for (const row of rows) {
    const at = safeDate(row?.created_at);
    const userId = String(row?.user_id || "").trim();
    if (!at || !userId) continue;
    users.get(keyFn(at).toISOString())?.add(userId);
  }
  for (const bucket of buckets) bucket.value = users.get(bucket.key)?.size || 0;
}

function uniqueUsers(rows) {
  return new Set(rows.map((row) => String(row?.user_id || "").trim()).filter(Boolean)).size;
}

function sumWatchSeconds(rows) {
  return rows.reduce((sum, row) => sum + Math.max(0, Number(row?.watch_seconds || 0)), 0);
}

function eventData(row) {
  return row?.event_data && typeof row.event_data === "object" ? row.event_data : {};
}

// Channel-level link health, same rule as the playlist Health tab:
// failing for viewers = at least 3 failures and failures >= successful plays.
async function getLinkHealth(admin) {
  const [{ data: links }, { data: sources, error: sourcesError }] = await Promise.all([
    fetchAllRows(() => admin.from("playlist_channels").select("playlist_slug,channel_id").order("channel_id")),
    fetchAllRows(() => admin
      .from("channel_sources")
      .select("id,channel_id,is_active,success_count,failure_count,last_failure_at")
      .order("id")),
  ]);
  const slugsByChannel = new Map();
  const slugCounts = new Map();
  for (const row of links || []) {
    const key = String(row.channel_id);
    const slug = String(row.playlist_slug || "");
    slugsByChannel.set(key, [...(slugsByChannel.get(key) || []), slug]);
    slugCounts.set(slug, (slugCounts.get(slug) || 0) + 1);
  }
  // Link each channel to the biggest playlist it belongs to.
  const primaryPlaylist = [...slugCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "";
  const slugByChannel = new Map(
    [...slugsByChannel.entries()].map(([id, slugs]) => [
      id,
      [...slugs].sort((a, b) => (slugCounts.get(b) || 0) - (slugCounts.get(a) || 0))[0],
    ])
  );
  const linkedIds = [...slugByChannel.keys()];
  const channels = await fetchByIds(admin, "channels", "id,name,status,logo_url", linkedIds);
  const channelById = new Map(channels.map((row) => [String(row.id), row]));

  const perChannel = new Map();
  for (const row of sources || []) {
    const key = String(row.channel_id);
    if (!slugByChannel.has(key)) continue;
    const item = perChannel.get(key) || { ok: 0, fail: 0, active: 0, lastFailureAt: null };
    item.ok += Number(row.success_count || 0);
    item.fail += Number(row.failure_count || 0);
    if (row.is_active) item.active += 1;
    if (row.last_failure_at && (!item.lastFailureAt || row.last_failure_at > item.lastFailureAt)) item.lastFailureAt = row.last_failure_at;
    perChannel.set(key, item);
  }

  let dead = 0;
  let singleLink = 0;
  const failing = [];
  for (const id of linkedIds) {
    const channel = channelById.get(id);
    if (!channel) continue;
    if (String(channel.status || "").toUpperCase() === "DEAD") dead += 1;
    const stats = perChannel.get(id);
    if (!stats || stats.active <= 1) singleLink += 1;
    if (stats && stats.fail >= 3 && stats.fail >= stats.ok) {
      failing.push({
        channel_id: id,
        channel_name: String(channel.name || id),
        logo_url: String(channel.logo_url || ""),
        playlist_slug: slugByChannel.get(id),
        failures: stats.fail,
        plays: stats.ok,
        last_failed_at: stats.lastFailureAt,
      });
    }
  }
  failing.sort((a, b) => b.failures - a.failures || String(b.last_failed_at || "").localeCompare(String(a.last_failed_at || "")));

  return {
    available: !sourcesError,
    linked_channels: linkedIds.length,
    live_channels: linkedIds.length - dead,
    dead_channels: dead,
    single_link_channels: singleLink,
    failing_channels: failing.length,
    failing_list: failing.slice(0, 8),
    primary_playlist: primaryPlaylist,
  };
}

async function getTopRadio(admin) {
  const [{ data: stations, error }, { data: sources }] = await Promise.all([
    admin.from("radio_stations").select("id,name,frequency,band,logo_url,is_active"),
    fetchAllRows(() => admin.from("radio_station_sources").select("station_id,success_count,failure_count,last_success_at").order("id")),
  ]);
  if (error) return { available: false, stations: 0, plays: 0, failures: 0, top: [], listened_24h: 0 };
  const byStation = new Map();
  const cutoff = new Date(Date.now() - DAY);
  let plays = 0;
  let failures = 0;
  for (const row of sources || []) {
    const key = String(row.station_id);
    const item = byStation.get(key) || { plays: 0, recent: false };
    item.plays += Number(row.success_count || 0);
    if (inRange(row.last_success_at, cutoff)) item.recent = true;
    plays += Number(row.success_count || 0);
    failures += Number(row.failure_count || 0);
    byStation.set(key, item);
  }
  const list = (stations || []).filter((s) => s.is_active !== false);
  const top = list
    .map((s) => ({
      id: String(s.id),
      name: String(s.name || ""),
      frequency: s.frequency != null ? `${s.band === "AM" ? Number(s.frequency) : Number(s.frequency).toFixed(1)} ${s.band === "AM" ? "kHz" : "MHz"}` : "",
      logo_url: String(s.logo_url || ""),
      plays: byStation.get(String(s.id))?.plays || 0,
    }))
    .filter((s) => s.plays > 0)
    .sort((a, b) => b.plays - a.plays)
    .slice(0, 5);
  return {
    available: true,
    stations: list.length,
    plays,
    failures,
    top,
    listened_24h: [...byStation.values()].filter((s) => s.recent).length,
  };
}

export async function getDashboardReports() {
  const admin = getSupabaseAdmin();
  const now = new Date();
  const cutoff24h = new Date(now.getTime() - DAY);
  const cutoff48h = new Date(now.getTime() - 2 * DAY);
  const cutoff7d = new Date(now.getTime() - 7 * DAY);
  const cutoff14d = new Date(now.getTime() - 14 * DAY);
  const cutoff30d = new Date(now.getTime() - 30 * DAY);
  const cutoff365d = new Date(now.getTime() - 365 * DAY);

  const [
    { data: events },
    { data: history },
    { data: users },
    [visitors24h, visitors7d, visitors30d, visitors365d],
    { count: totalLoginsCount },
    { count: totalAttemptsCount },
    { count: totalFailuresCount },
    archiveTotalsResult,
    linkHealth,
    radio,
    { count: publishedMovies },
  ] = await Promise.all([
    fetchAllRows(() => admin
      .from("client_activity_events")
      .select("user_id,event_type,event_data,created_at")
      .gte("created_at", cutoff7d.toISOString())
      .order("created_at", { ascending: false })),
    fetchAllRows(() => admin
      .from("client_recent_history")
      .select("user_id,channel_id,channel_name,watch_seconds,watched_at,source")
      .gte("watched_at", cutoff7d.toISOString())
      .neq("source", "sync")
      .order("watched_at", { ascending: false })),
    fetchAllRows(() => admin
      .from("client_users")
      .select("user_id,approval_status,auth_provider,created_at")
      .order("created_at", { ascending: false })),
    Promise.all([
      fetchUniqueVisitorBuckets(admin, cutoff24h, "hour"),
      fetchUniqueVisitorBuckets(admin, cutoff7d, "day"),
      fetchUniqueVisitorBuckets(admin, cutoff30d, "day"),
      fetchUniqueVisitorBuckets(admin, cutoff365d, "month"),
    ]),
    admin.from("client_activity_events").select("id", { count: "exact", head: true }).eq("event_type", "client_login"),
    admin.from("client_activity_events").select("id", { count: "exact", head: true }).eq("event_type", "playback_attempt"),
    admin.from("client_activity_events").select("id", { count: "exact", head: true }).eq("event_type", "playback_failed"),
    admin.from("client_activity_event_archive_totals").select("event_type,archived_count"),
    getLinkHealth(admin),
    getTopRadio(admin),
    admin.from("movies").select("id", { count: "exact", head: true }).eq("is_published", true),
  ]);

  const archivedCounts = new Map(
    (Array.isArray(archiveTotalsResult?.data) ? archiveTotalsResult.data : []).map((row) => [
      String(row?.event_type || ""),
      Math.max(0, Number(row?.archived_count || 0)),
    ])
  );
  const archived = (type) => archivedCounts.get(type) || 0;

  const eventRows = Array.isArray(events) ? events : [];
  const historyRows = Array.isArray(history) ? history : [];
  const userRows = Array.isArray(users) ? users : [];
  const ofType = (type) => eventRows.filter((row) => row?.event_type === type);

  // Last 24h vs the 24h before it.
  const windows = { cur: [cutoff24h, null], prev: [cutoff48h, cutoff24h] };
  const pick = (rows, field, [from, to]) => rows.filter((row) => inRange(row?.[field], from, to));
  const compare = (fn) => ({ current: fn(windows.cur), previous: fn(windows.prev) });

  const attempts = ofType("playback_attempt");
  const failures = ofType("playback_failed");
  const activeViewers = compare((w) => uniqueUsers([
    ...pick(eventRows, "created_at", w),
    ...pick(historyRows, "watched_at", w),
  ]));
  const watchSeconds = compare((w) => sumWatchSeconds(pick(historyRows, "watched_at", w)));
  const plays = compare((w) => pick(attempts, "created_at", w).length + pick(ofType("movie_playback_attempt"), "created_at", w).length);
  const failureRate = compare((w) => {
    const a = pick(attempts, "created_at", w).length;
    const f = pick(failures, "created_at", w).length;
    return a > 0 ? Math.round((f / a) * 1000) / 10 : 0;
  });
  const newUsers = {
    current: userRows.filter((row) => inRange(row?.created_at, cutoff7d)).length,
    previous: userRows.filter((row) => inRange(row?.created_at, cutoff14d, cutoff7d)).length,
  };

  // Top channels by watch time (7d).
  const channelAgg = new Map();
  for (const row of historyRows) {
    const id = String(row?.channel_id || "").trim();
    if (!id) continue;
    const item = channelAgg.get(id) || { channel_id: id, channel_name: String(row?.channel_name || id), watch_seconds: 0, viewers: new Set() };
    item.watch_seconds += Math.max(0, Number(row?.watch_seconds || 0));
    if (row?.user_id) item.viewers.add(String(row.user_id));
    channelAgg.set(id, item);
  }
  const topChannels = [...channelAgg.values()]
    .sort((a, b) => b.watch_seconds - a.watch_seconds)
    .slice(0, 6)
    .map((item) => ({ ...item, viewers: item.viewers.size }));
  if (topChannels.length) {
    const logos = await fetchByIds(admin, "channels", "id,logo_url", topChannels.map((c) => c.channel_id));
    const logoById = new Map(logos.map((row) => [String(row.id), String(row.logo_url || "")]));
    for (const item of topChannels) item.logo_url = logoById.get(item.channel_id) || "";
  }

  // Top movies (7d): unique viewers from movie start/progress events.
  const movieAgg = new Map();
  for (const row of eventRows) {
    const type = String(row?.event_type || "");
    if (type !== "movie_playback_attempt" && type !== "movie_progress") continue;
    const id = String(eventData(row)?.movie_id || "").trim();
    if (!id) continue;
    const item = movieAgg.get(id) || { movie_id: id, viewers: new Set(), plays: 0 };
    if (row?.user_id) item.viewers.add(String(row.user_id));
    if (type === "movie_playback_attempt") item.plays += 1;
    movieAgg.set(id, item);
  }
  let topMovies = [...movieAgg.values()]
    .map((item) => ({ movie_id: item.movie_id, viewers: item.viewers.size, plays: item.plays }))
    .sort((a, b) => b.viewers - a.viewers || b.plays - a.plays)
    .slice(0, 6);
  if (topMovies.length) {
    const movies = await fetchByIds(admin, "movies", "id,title,poster_url,release_year", topMovies.map((m) => m.movie_id));
    const byId = new Map(movies.map((row) => [String(row.id), row]));
    topMovies = topMovies.map((item) => {
      const movie = byId.get(item.movie_id) || {};
      return {
        ...item,
        title: String(movie.title || `Movie #${item.movie_id}`),
        poster_url: String(movie.poster_url || ""),
        release_year: movie.release_year || null,
      };
    });
  }

  // Channels that failed most for viewers (7d), from player events.
  const failAgg = new Map();
  for (const row of attempts) {
    const id = String(eventData(row)?.channel_id || "").trim();
    if (!id) continue;
    const item = failAgg.get(id) || { channel_id: id, channel_name: String(eventData(row)?.channel_name || id), attempts: 0, failures: 0, last_failed_at: null };
    item.attempts += 1;
    failAgg.set(id, item);
  }
  for (const row of failures) {
    const data = eventData(row);
    const id = String(data?.channel_id || "").trim();
    if (!id) continue;
    const item = failAgg.get(id) || { channel_id: id, channel_name: String(data?.channel_name || id), attempts: 0, failures: 0, last_failed_at: null };
    item.failures += 1;
    if (!item.last_failed_at || row.created_at > item.last_failed_at) item.last_failed_at = row.created_at;
    if (item.channel_name === id && data?.channel_name) item.channel_name = String(data.channel_name);
    failAgg.set(id, item);
  }
  // Skip channels deleted since (removed dead links, merged duplicates).
  const failedCandidates = [...failAgg.values()].filter((item) => item.failures > 0);
  const existing = new Set(
    (await fetchByIds(admin, "channels", "id", failedCandidates.map((item) => item.channel_id))).map((row) => String(row.id))
  );
  const failedChannels7d = failedCandidates
    .filter((item) => existing.has(item.channel_id))
    .map((item) => ({ ...item, failure_rate_pct: item.attempts > 0 ? Math.min(100, Math.round((item.failures / item.attempts) * 100)) : 100 }))
    .sort((a, b) => b.failures - a.failures || b.failure_rate_pct - a.failure_rate_pct)
    .slice(0, 8);

  // Viewer trend (unique signed-in viewers per bucket).
  const trend = buildTrendBuckets(now);
  const visitorRows = [
    ...eventRows.filter((row) => VISITOR_EVENT_TYPES.includes(String(row?.event_type || ""))),
    ...historyRows.map((row) => ({ user_id: row?.user_id, created_at: row?.watched_at })),
  ];
  const applyCounts = (buckets, counts, keyFn, since) => {
    if (counts) for (const bucket of buckets) bucket.value = counts.get(bucket.key) || 0;
    else fillUniqueBuckets(buckets, keyFn, visitorRows.filter((r) => inRange(r?.created_at, since)));
  };
  applyCounts(trend.day, visitors24h, startOfHour, cutoff24h);
  applyCounts(trend.week, visitors7d, startOfDay, cutoff7d);
  applyCounts(trend.month, visitors30d, startOfDay, cutoff30d);
  applyCounts(trend.year, visitors365d, startOfMonth, cutoff365d);

  // Sign-in methods (24h).
  const loginMethods = new Map();
  for (const row of pick(ofType("client_login"), "created_at", windows.cur)) {
    const method = String(eventData(row)?.via || "unknown").trim() || "unknown";
    loginMethods.set(method, (loginMethods.get(method) || 0) + 1);
  }

  const status = (row) => String(row?.approval_status || "").toLowerCase();

  return {
    generated_at: now.toISOString(),
    kpi: {
      active_viewers_24h: activeViewers,
      watch_seconds_24h: watchSeconds,
      plays_24h: plays,
      failure_rate_24h: failureRate,
      new_users_7d: newUsers,
    },
    totals: {
      logins: Math.max(0, Number(totalLoginsCount || 0)) + archived("client_login"),
      playback_attempts: Math.max(0, Number(totalAttemptsCount || 0)) + archived("playback_attempt"),
      playback_failures: Math.max(0, Number(totalFailuresCount || 0)) + archived("playback_failed"),
      published_movies: Math.max(0, Number(publishedMovies || 0)),
    },
    users: {
      total: userRows.length,
      approved: userRows.filter((row) => status(row) === "approved").length,
      pending: userRows.filter((row) => status(row) === "pending").length,
      facebook: userRows.filter((row) => String(row?.auth_provider || "").toLowerCase() === "facebook").length,
      logins_24h: [...loginMethods.values()].reduce((a, b) => a + b, 0),
      login_methods_24h: [...loginMethods.entries()].sort((a, b) => b[1] - a[1]),
    },
    link_health: linkHealth,
    radio,
    top_channels_7d: topChannels,
    top_movies_7d: topMovies,
    failed_channels_7d: failedChannels7d,
    viewer_trend: trend,
  };
}
