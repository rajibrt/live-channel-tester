import Link from "next/link";
import { Bell } from "lucide-react";
import { getSupabaseAdmin } from "../../lib/supabaseAdmin";
import { getActiveViewerSnapshot } from "../../lib/activeViewers";
import { getDashboardReports } from "../../lib/dashboardReports";
import styles from "./page.module.css";
import CopyUrlButton from "./CopyUrlButton";
import ActiveViewersPanel from "./ActiveViewersPanel";
import UserArrivalTrendCharts from "./UserArrivalTrendCharts";

async function getData() {
  const supabase = getSupabaseAdmin();
  const [{ data: playlists }, { data: tokens }, { data: jobRun }, { data: pushSubscriptions }, activeViewers, reports] = await Promise.all([
    supabase
      .from("playlists")
      .select("slug,name,channel_count,updated_at")
      .order("updated_at", { ascending: false }),
    supabase
      .from("playlist_tokens")
      .select("playlist_slug,token,is_active")
      .eq("is_active", true),
    supabase
      .from("job_runs")
      .select("job_name,last_run_at,last_status,last_message,last_total,last_live,last_dead,is_enabled")
      .eq("job_name", "playlist_health_hourly")
      .maybeSingle(),
    supabase
      .from("client_push_subscriptions")
      .select("user_id,endpoint,is_active,updated_at")
      .eq("is_active", true)
      .order("updated_at", { ascending: false }),
    getActiveViewerSnapshot(),
    getDashboardReports(),
  ]);
  const tokenBySlug = Object.fromEntries((tokens || []).map((t) => [t.playlist_slug, t.token]));
  const activePushRows = Array.isArray(pushSubscriptions) ? pushSubscriptions.filter((row) => row?.user_id) : [];
  const activePushUserIds = [...new Set(activePushRows.map((row) => String(row.user_id)))];

  let pushEnabledClients = [];
  if (activePushUserIds.length) {
    const { data: clientUsers } = await supabase
      .from("client_users")
      .select("user_id,full_name,email,mobile_number,is_active,approval_status")
      .in("user_id", activePushUserIds);

    const clientById = new Map((clientUsers || []).map((row) => [String(row.user_id), row]));
    const groupedByUser = activePushRows.reduce((map, row) => {
      const key = String(row.user_id);
      const bucket = map.get(key) || [];
      bucket.push(row);
      map.set(key, bucket);
      return map;
    }, new Map());

    pushEnabledClients = Array.from(groupedByUser.entries())
      .map(([userId, rows]) => {
        const client = clientById.get(userId) || {};
        const latestUpdatedAt = rows
          .map((row) => row?.updated_at)
          .filter(Boolean)
          .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] || null;

        return {
          user_id: userId,
          full_name: String(client.full_name || "").trim(),
          email: String(client.email || "").trim(),
          mobile_number: String(client.mobile_number || "").trim(),
          approval_status: String(client.approval_status || "").trim(),
          is_active: typeof client.is_active === "boolean" ? client.is_active : true,
          subscription_count: rows.length,
          updated_at: latestUpdatedAt,
        };
      })
      .sort((a, b) => new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime());
  }

  return {
    playlists: playlists || [],
    tokenBySlug,
    jobRun: jobRun || null,
    activeViewers,
    reports,
    pushEnabledClients,
  };
}

function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Number(totalSeconds || 0));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function toPercent(part, whole) {
  const p = Number(part || 0);
  const w = Number(whole || 0);
  if (w <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((p / w) * 100)));
}

function formatShortCount(value) {
  const n = Number(value || 0);
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export default async function DashboardPage() {
  const { playlists, tokenBySlug, jobRun, activeViewers, reports, pushEnabledClients } = await getData();
  const base = process.env.PUBLIC_PLAYLIST_BASE_URL || "";
  const activeTokenCount = Object.keys(tokenBySlug).length;
  const lastRunText = jobRun?.last_run_at
    ? new Date(jobRun.last_run_at).toLocaleString()
    : "Not run yet";
  const cronEnabled = typeof jobRun?.is_enabled === "boolean" ? jobRun.is_enabled : true;
  const cronOk = cronEnabled && String(jobRun?.last_status || "").toLowerCase() === "ok";
  const loginMethods = Object.entries(reports?.login_methods_24h || {}).slice(0, 5);
  const totalLogins24 = loginMethods.reduce((sum, [, value]) => sum + Number(value || 0), 0);
  const topChannels7d = Array.isArray(reports?.top_channels_7d) ? reports.top_channels_7d : [];
  const topChannelMax = Math.max(...topChannels7d.map((row) => Number(row?.watch_seconds || 0)), 0);

  const pendingApprovals = Number(reports?.pending_approvals || 0);
  const approvedUsers = Number(reports?.approved_users || 0);
  const approvalTotal = pendingApprovals + approvedUsers;
  const pendingPct = toPercent(pendingApprovals, approvalTotal);
  const approvedPct = Math.max(0, 100 - pendingPct);
  const visitorTrend = reports?.visitor_trend || reports?.user_login_trend || {};
  const guestVisitorTrend = reports?.guest_visitor_trend || {};
  const clientViewerTrend = reports?.client_viewer_trend || {};
  const trendPanels = [
    { key: "all-day", title: "All Viewers 24h", data: Array.isArray(visitorTrend.day) ? visitorTrend.day : [] },
    { key: "all-week", title: "All Viewers 7d", data: Array.isArray(visitorTrend.week) ? visitorTrend.week : [] },
    { key: "all-month", title: "All Viewers 30d", data: Array.isArray(visitorTrend.month) ? visitorTrend.month : [] },
    { key: "all-year", title: "All Viewers 12m", data: Array.isArray(visitorTrend.year) ? visitorTrend.year : [] },
  ];
  const guestTrendPanels = [
    { key: "guest-day", title: "Guests 24h", data: Array.isArray(guestVisitorTrend.day) ? guestVisitorTrend.day : [] },
    { key: "guest-week", title: "Guests 7d", data: Array.isArray(guestVisitorTrend.week) ? guestVisitorTrend.week : [] },
    { key: "client-day", title: "Logged-in 24h", data: Array.isArray(clientViewerTrend.day) ? clientViewerTrend.day : [] },
    { key: "client-week", title: "Logged-in 7d", data: Array.isArray(clientViewerTrend.week) ? clientViewerTrend.week : [] },
  ];
  const topViewerChannels7d = Array.isArray(reports?.top_viewer_channels_7d) ? reports.top_viewer_channels_7d : [];
  const recentViewerEvents = Array.isArray(reports?.recent_viewer_events) ? reports.recent_viewer_events : [];

  return (
    <>
      <section className={`${styles.stats} ${styles.statsCompact4}`}>
        <article className={styles.statCard}>
          <p>Total Playlists</p>
          <strong>{playlists.length}</strong>
        </article>
        <article className={styles.statCard}>
          <p>Active Tokens</p>
          <strong>{activeTokenCount}</strong>
        </article>
        <article className={styles.statCard}>
          <p>Total Channels</p>
          <strong>{playlists.reduce((sum, p) => sum + (Number(p.channel_count) || 0), 0)}</strong>
        </article>
        <ActiveViewersPanel title="Watching Now" viewers={activeViewers?.viewers || []} />
      </section>

      <section className={`${styles.stats} ${styles.statsCompact4}`}>
        <article className={styles.statCard}>
          <p>Guest Visitors (24h)</p>
          <strong>{Number(reports?.guest_unique_24h || 0)}</strong>
          <small className={styles.metaMuted}>7d unique: {Number(reports?.guest_unique_7d || 0)}</small>
        </article>
        <article className={styles.statCard}>
          <p>Logged-in Viewers (24h)</p>
          <strong>{Number(reports?.client_unique_24h || 0)}</strong>
          <small className={styles.metaMuted}>7d unique: {Number(reports?.client_unique_7d || 0)}</small>
        </article>
        <article className={styles.statCard}>
          <p>Total Viewers (24h)</p>
          <strong>{Number(reports?.total_unique_viewers_24h || 0)}</strong>
          <small className={styles.metaMuted}>Events: {Number(reports?.guest_events_24h || 0) + Number(reports?.client_viewer_events_24h || 0)}</small>
        </article>
        <article className={styles.statCard}>
          <p>Guest Watch Time (24h)</p>
          <strong>{formatDuration(reports?.guest_watch_seconds_24h)}</strong>
          <small className={styles.metaMuted}>Tracked without login</small>
        </article>
      </section>

      <section className={`${styles.stats} ${styles.statsCompact4}`}>
        <article className={styles.statCard}>
          <p>Total Sessions</p>
          <strong>{Number(reports?.total_sessions || 0)}</strong>
          <small className={styles.metaMuted}>Last 24h: {Number(reports?.sessions_24h || 0)}</small>
        </article>
        <article className={styles.statCard}>
          <p>Total Users</p>
          <strong>{Number(reports?.total_users || 0)}</strong>
          <small className={styles.metaMuted}>New users (7d): {Number(reports?.new_users_7d || 0)}</small>
        </article>
        <article className={styles.statCard}>
          <p>Total Watch Sessions</p>
          <strong>{Number(reports?.total_watch_sessions || 0)}</strong>
          <small className={styles.metaMuted}>Last 24h: {Number(reports?.watch_sessions_24h || 0)}</small>
        </article>
        <article className={styles.statCard}>
          <p>Client Approval</p>
          <strong>{pendingApprovals} Pending</strong>
          <small className={styles.metaMuted}>Approved: {approvedUsers} | Facebook: {Number(reports?.facebook_users || 0)}</small>
        </article>
      </section>

      <section className={`${styles.stats} ${styles.statsCompact4}`}>
        <article className={styles.statCard}>
          <p>Watch Time (24h)</p>
          <strong>{formatDuration(reports?.watch_seconds_24h)}</strong>
          <small className={styles.metaMuted}>Active users (24h): {Number(reports?.active_users_24h || 0)}</small>
        </article>
        <article className={styles.statCard}>
          <p>Total Playback Attempts</p>
          <strong>{Number(reports?.total_playback_attempts || 0)}</strong>
          <small className={styles.metaMuted}>Last 7 days: {Number(reports?.playback_attempts_7d || 0)}</small>
        </article>
        <article className={styles.statCard}>
          <p>Total Playback Failures</p>
          <strong>{Number(reports?.total_playback_failures || 0)}</strong>
          <small className={styles.metaMuted}>Last 24h: {Number(reports?.playback_failures_24h || 0)}</small>
        </article>
        <article className={styles.statCard}>
          <p>Avg Session (24h)</p>
          <strong>{formatDuration(reports?.avg_watch_seconds_per_session_24h)}</strong>
          <small className={styles.metaMuted}>
            Unique channels: {Number(reports?.unique_channels_24h || 0)}
          </small>
        </article>
      </section>

      <section className={`${styles.stats} ${styles.statsCompact3}`}>
        <article className={styles.card}>
          <h2>Push Enabled</h2>
          <p className={styles.hint}>Clients who currently have push notifications enabled.</p>
          <p className={styles.metaLine}>
            <Bell size={14} />
            Total Active: <strong>{pushEnabledClients.length}</strong>
          </p>
        </article>
      </section>

      <section className={styles.chartsGrid}>
        <article className={`${styles.card} ${styles.chartCard}`}>
          <h2>Login Mix (24h)</h2>
          <p className={styles.hint}>Sign-in methods in the last 24 hours.</p>
          <div className={styles.miniBars}>
            {loginMethods.length ? (
              loginMethods.map(([method, count], index) => {
                const safeCount = Number(count || 0);
                const pct = toPercent(safeCount, totalLogins24 || 1);
                return (
                  <div key={method} className={styles.miniBarRow}>
                    <div className={styles.miniBarLabel}>
                      <span>{method}</span>
                      <strong>{formatShortCount(safeCount)}</strong>
                    </div>
                    <div className={styles.miniBarTrack}>
                      <span
                        className={`${styles.miniBarFill} ${styles[`barTone${(index % 5) + 1}`]}`}
                        style={{ width: `${Math.max(8, pct)}%` }}
                        aria-hidden="true"
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <p className={styles.pending}>No login method data yet.</p>
            )}
          </div>
        </article>

        <article className={`${styles.card} ${styles.chartCard}`}>
          <h2>Approval Snapshot</h2>
          <p className={styles.hint}>Current user approval state.</p>
          <div className={styles.donutWrap}>
            <div
              className={styles.donutChart}
              style={{
                background: `conic-gradient(var(--chart-2) 0% ${approvedPct}%, var(--destructive) ${approvedPct}% 100%)`,
              }}
              aria-hidden="true"
            >
              <div className={styles.donutCenter}>
                <strong>{approvalTotal}</strong>
                <span>Users</span>
              </div>
            </div>
            <div className={styles.donutLegend}>
              <p><span className={`${styles.legendDot} ${styles.legendApproved}`} /> Approved: {approvedUsers}</p>
              <p><span className={`${styles.legendDot} ${styles.legendPending}`} /> Pending: {pendingApprovals}</p>
            </div>
          </div>
        </article>

        <article className={`${styles.card} ${styles.chartCard}`}>
          <h2>Top Channels (7d)</h2>
          <p className={styles.hint}>Quick watch-time ranking.</p>
          <div className={styles.miniBars}>
            {topChannels7d.slice(0, 5).length ? (
              topChannels7d.slice(0, 5).map((row, index) => {
                const seconds = Number(row?.watch_seconds || 0);
                const pct = topChannelMax > 0 ? Math.round((seconds / topChannelMax) * 100) : 0;
                return (
                  <div key={`${row.channel_id}-${index}`} className={styles.miniBarRow}>
                    <div className={styles.miniBarLabel}>
                      <span title={row.channel_name || row.channel_id || "-"}>{row.channel_name || row.channel_id || "-"}</span>
                      <strong>{formatDuration(seconds)}</strong>
                    </div>
                    <div className={styles.miniBarTrack}>
                      <span
                        className={`${styles.miniBarFill} ${styles[`barTone${(index % 5) + 1}`]}`}
                        style={{ width: `${Math.max(10, pct)}%` }}
                        aria-hidden="true"
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <p className={styles.pending}>No watch data found for last 7 days.</p>
            )}
          </div>
        </article>
      </section>

      <section className={styles.lineTrendSection}>
        <article className={`${styles.card} ${styles.chartCard}`}>
          <h2>Viewer Analytics</h2>
          <p className={styles.hint}>Unique guest and logged-in viewers grouped by day, week, month, and year.</p>
          <UserArrivalTrendCharts trendPanels={trendPanels} />
        </article>
      </section>

      <section className={styles.lineTrendSection}>
        <article className={`${styles.card} ${styles.chartCard}`}>
          <h2>Guest vs Logged-in</h2>
          <p className={styles.hint}>Separate comparison for visitors without login and signed-in clients.</p>
          <UserArrivalTrendCharts trendPanels={guestTrendPanels} />
        </article>
      </section>

      <section className={styles.grid}>
        <article className={styles.card}>
          <h2>Playlists</h2>
          <p className={styles.hint}>Create/update playlist and rotate permanent token.</p>
          <Link href="/dashboard/playlists" className={styles.navCta}>Open Playlists</Link>
        </article>
        <article className={styles.card}>
          <h2>Channels</h2>
          <p className={styles.hint}>Attach stream URLs and metadata to a playlist.</p>
          <Link href="/dashboard/channels" className={styles.navCta}>Open Channels</Link>
        </article>
        <article className={styles.card}>
          <h2>Client Users</h2>
          <p className={styles.hint}>Create viewer accounts and control login access.</p>
          <Link href="/dashboard/clients" className={styles.navCta}>Open Clients</Link>
        </article>
        <article className={styles.card}>
          <h2>Push Enabled</h2>
          <p className={styles.hint}>Clients who currently have push notifications enabled.</p>
          <p className={styles.metaLine}>
            <Bell size={14} />
            Total Active: <strong>{pushEnabledClients.length}</strong>
          </p>
        </article>
        <article className={styles.card}>
          <h2>Articles</h2>
          <p className={styles.hint}>Manage editorial articles, guides, and featured reading content.</p>
          <Link href="/dashboard/articles" className={styles.navCta}>Open Articles</Link>
        </article>
        <article className={styles.card}>
          <h2>Announcements</h2>
          <p className={styles.hint}>Post ticker updates, maintenance notices, and alert-style announcements.</p>
          <Link href="/dashboard/announcements" className={styles.navCta}>Open Announcements</Link>
        </article>
        <article className={styles.card}>
          <h2>Last Cron Run</h2>
          <p className={styles.hint}>Hourly playlist health auto-check status.</p>
          <p className={styles.metaLine}>
            <span className={`${styles.statusDot} ${cronOk ? styles.statusLive : styles.statusDead}`} aria-hidden="true" />
            <strong>{lastRunText}</strong> | Cron: <strong>{cronEnabled ? "ON" : "OFF"}</strong>
          </p>
          <p className={styles.metaLine}>
            Total: <strong>{Number(jobRun?.last_total || 0)}</strong> | LIVE: <strong>{Number(jobRun?.last_live || 0)}</strong> | DEAD: <strong>{Number(jobRun?.last_dead || 0)}</strong>
          </p>
          {jobRun?.last_message ? <p className={styles.hint}>{jobRun.last_message}</p> : null}
          <form method="post" action="/api/admin/cron/toggle" className={styles.metaActions}>
            <input type="hidden" name="enabled" value={cronEnabled ? "false" : "true"} />
            <button type="submit" className={cronEnabled ? styles.secondaryBtn : styles.primaryBtn}>
              Turn Cron {cronEnabled ? "OFF" : "ON"}
            </button>
          </form>
        </article>
        <article className={styles.card}>
          <h2>Local Check</h2>
          <p className={styles.hint}>Run Local IP/ISP check with progress + live preview.</p>
          <Link href="/dashboard/local-check" className={styles.navCta}>Open Local Check</Link>
        </article>
      </section>

      <details className={`${styles.card} ${styles.tableCard} ${styles.collapsibleCard}`}>
        <summary className={styles.collapsibleSummary}>Detailed Tables</summary>
        <div className={styles.collapsibleBody}>
          <h2>Top Channels (Last 7 Days)</h2>
          <p className={styles.hint}>Highest total watch-time channels from client watch history.</p>
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Channel</th>
                  <th>Views</th>
                  <th>Watch Time</th>
                </tr>
              </thead>
              <tbody>
                {topChannels7d.length ? (
                  topChannels7d.map((row, index) => (
                    <tr key={`${row.channel_id}-${index}`}>
                      <td>{index + 1}</td>
                      <td>{row.channel_name || row.channel_id || "-"}</td>
                      <td>{Number(row.views || 0)}</td>
                      <td>{formatDuration(row.watch_seconds)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className={styles.pending}>No watch data found for the last 7 days.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <h2 className={styles.tableTitleGap}>Playlists</h2>
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Slug</th>
                  <th>Channels</th>
                  <th>Token URL</th>
                </tr>
              </thead>
              <tbody>
                {playlists.map((p) => {
                  const token = tokenBySlug[p.slug];
                  const url = token && base ? `${base}/playlist/${token}.m3u` : "";
                  return (
                    <tr key={p.slug}>
                      <td>
                        <Link href={`/dashboard/playlists/${p.slug}`} className={styles.url}>
                          {p.name}
                        </Link>
                      </td>
                      <td>{p.slug}</td>
                      <td>{p.channel_count}</td>
                      <td>
                        {url ? (
                          <div className={styles.urlCell}>
                            <a href={url} target="_blank" rel="noreferrer" className={styles.url}>
                              {url}
                            </a>
                            <CopyUrlButton value={url} />
                          </div>
                        ) : (
                          <span className={styles.pending}>Generate token</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <h2 className={styles.tableTitleGap}>Top Failed Channels (Last 7 Days)</h2>
          <p className={styles.hint}>Channels users repeatedly tried to play but failed.</p>
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Channel</th>
                  <th>Failures</th>
                  <th>Attempts</th>
                  <th>Fail Rate</th>
                  <th>Last Failed</th>
                </tr>
              </thead>
              <tbody>
                {(Array.isArray(reports?.top_playback_failures_7d) ? reports.top_playback_failures_7d : []).length ? (
                  (reports.top_playback_failures_7d || []).map((row, index) => (
                    <tr key={`${row.channel_id}-${index}`}>
                      <td>{index + 1}</td>
                      <td>{row.channel_name || row.channel_id || "-"}</td>
                      <td>{Number(row.failures || 0)}</td>
                      <td>{Number(row.attempts || 0)}</td>
                      <td>{Number(row.failure_rate_pct || 0)}%</td>
                      <td>{row.last_failed_at ? new Date(row.last_failed_at).toLocaleString() : "-"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className={styles.pending}>No failed playback data found for the last 7 days.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <h2 className={styles.tableTitleGap}>Top Viewer Channels (Guest + Logged-in, Last 7 Days)</h2>
          <p className={styles.hint}>Channels ranked by unique tracked viewers across guest and client sessions.</p>
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Channel</th>
                  <th>Guest Viewers</th>
                  <th>Logged-in Viewers</th>
                  <th>Events</th>
                  <th>Tracked Watch Time</th>
                </tr>
              </thead>
              <tbody>
                {topViewerChannels7d.length ? (
                  topViewerChannels7d.map((row, index) => (
                    <tr key={`${row.channel_id}-${index}`}>
                      <td>{index + 1}</td>
                      <td>{row.channel_name || row.channel_id || "-"}</td>
                      <td>{Number(row.guest_viewers || 0)}</td>
                      <td>{Number(row.client_viewers || 0)}</td>
                      <td>{Number(row.events || 0)}</td>
                      <td>{formatDuration(row.watch_seconds)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className={styles.pending}>No unified viewer channel data found yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <h2 className={styles.tableTitleGap}>Recent Viewer History</h2>
          <p className={styles.hint}>Latest guest and logged-in viewer activity captured by the analytics table.</p>
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Viewer</th>
                  <th>Event</th>
                  <th>Route</th>
                  <th>Content</th>
                  <th>Duration</th>
                </tr>
              </thead>
              <tbody>
                {recentViewerEvents.length ? (
                  recentViewerEvents.map((row, index) => (
                    <tr key={`${row.created_at}-${index}`}>
                      <td>{row.created_at ? new Date(row.created_at).toLocaleString() : "-"}</td>
                      <td>{row.viewer_type === "client" ? "Logged-in" : "Guest"} {row.viewer_key ? `(${row.viewer_key})` : ""}</td>
                      <td>{row.event_type || "-"}</td>
                      <td>{row.route || "-"}</td>
                      <td>{row.channel_name || row.movie_title || "-"}</td>
                      <td>{Number(row.watch_seconds || 0) > 0 ? formatDuration(row.watch_seconds) : "-"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className={styles.pending}>No viewer history found yet. Run the new SQL migration first if this stays empty.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </details>
    </>
  );
}
