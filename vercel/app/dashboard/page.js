import Link from "next/link";
import { getSupabaseAdmin } from "../../lib/supabaseAdmin";
import { getActiveViewerSnapshot } from "../../lib/activeViewers";
import { getDashboardReports } from "../../lib/dashboardReports";
import styles from "./page.module.css";
import CopyUrlButton from "./CopyUrlButton";
import ActiveViewersPanel from "./ActiveViewersPanel";

async function getData() {
  const supabase = getSupabaseAdmin();
  const [{ data: playlists }, { data: tokens }, { data: jobRun }, activeViewers, reports] = await Promise.all([
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
    getActiveViewerSnapshot(),
    getDashboardReports(),
  ]);
  const tokenBySlug = Object.fromEntries((tokens || []).map((t) => [t.playlist_slug, t.token]));
  return { playlists: playlists || [], tokenBySlug, jobRun: jobRun || null, activeViewers, reports };
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

function toNiceMax(value) {
  const v = Math.max(1, Number(value || 0));
  if (v <= 5) return 5;
  if (v <= 10) return 10;
  if (v <= 20) return 20;
  const magnitude = Math.pow(10, Math.floor(Math.log10(v)));
  return Math.ceil(v / magnitude) * magnitude;
}

function buildSmoothLineModel(values, width = 760, height = 280) {
  const safeValues = Array.isArray(values) ? values.map((n) => Math.max(0, Number(n || 0))) : [];
  const pad = { top: 18, right: 16, bottom: 36, left: 44 };
  const plotW = Math.max(1, width - pad.left - pad.right);
  const plotH = Math.max(1, height - pad.top - pad.bottom);
  if (!safeValues.length) {
    return {
      width,
      height,
      pad,
      path: "",
      area: "",
      points: [],
      yMax: 10,
      activeIndex: 0,
    };
  }

  const maxRaw = Math.max(...safeValues, 0);
  const yMax = toNiceMax(maxRaw);
  const stepX = safeValues.length > 1 ? plotW / (safeValues.length - 1) : 0;
  const points = safeValues.map((value, idx) => {
    const ratio = yMax > 0 ? value / yMax : 0;
    const x = pad.left + idx * stepX;
    const y = pad.top + (1 - ratio) * plotH;
    return { x, y, value };
  });

  let path = "";
  if (points.length === 1) {
    path = `M${points[0].x},${points[0].y}`;
  } else {
    path = `M${points[0].x.toFixed(2)},${points[0].y.toFixed(2)}`;
    for (let i = 0; i < points.length - 1; i += 1) {
      const p0 = points[Math.max(0, i - 1)];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[Math.min(points.length - 1, i + 2)];
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      path += ` C${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`;
    }
  }

  const baseY = pad.top + plotH;
  const area = `${path} L${(pad.left + plotW).toFixed(2)},${baseY.toFixed(2)} L${pad.left.toFixed(2)},${baseY.toFixed(2)} Z`;
  const activeIndex = points.reduce((best, p, idx) => (p.value > points[best].value ? idx : best), 0);

  return { width, height, pad, path, area, points, yMax, activeIndex };
}

export default async function DashboardPage() {
  const { playlists, tokenBySlug, jobRun, activeViewers, reports } = await getData();
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
  const loginTrend = reports?.user_login_trend || {};
  const trendPanels = [
    { key: "day", title: "Day (24h)", data: Array.isArray(loginTrend.day) ? loginTrend.day : [] },
    { key: "week", title: "Week (7d)", data: Array.isArray(loginTrend.week) ? loginTrend.week : [] },
    { key: "month", title: "Month (30d)", data: Array.isArray(loginTrend.month) ? loginTrend.month : [] },
    { key: "year", title: "Year (12m)", data: Array.isArray(loginTrend.year) ? loginTrend.year : [] },
  ];

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
          <p>Total Sessions (24h)</p>
          <strong>{Number(reports?.sessions_24h || 0)}</strong>
          <small className={styles.metaMuted}>Last 7 days: {Number(reports?.sessions_7d || 0)}</small>
        </article>
        <article className={styles.statCard}>
          <p>New Devices (24h)</p>
          <strong>{Number(reports?.new_devices_24h || 0)}</strong>
          <small className={styles.metaMuted}>Known devices: {Number(reports?.known_devices_24h || 0)}</small>
        </article>
        <article className={styles.statCard}>
          <p>Active Users (24h)</p>
          <strong>{Number(reports?.active_users_24h || 0)}</strong>
          <small className={styles.metaMuted}>Returning (7d): {Number(reports?.returning_viewers_7d || 0)}</small>
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
          <small className={styles.metaMuted}>Sessions: {Number(reports?.watch_sessions_24h || 0)}</small>
        </article>
        <article className={styles.statCard}>
          <p>Avg Session (24h)</p>
          <strong>{formatDuration(reports?.avg_watch_seconds_per_session_24h)}</strong>
          <small className={styles.metaMuted}>Unique channels: {Number(reports?.unique_channels_24h || 0)}</small>
        </article>
        <article className={styles.statCard}>
          <p>New Users (7d)</p>
          <strong>{Number(reports?.new_users_7d || 0)}</strong>
          <small className={styles.metaMuted}>Known devices (24h): {Number(reports?.known_devices_24h || 0)}</small>
        </article>
        <article className={styles.statCard}>
          <p>Playback Failures</p>
          <strong>{Number(reports?.playback_failures_24h || 0)} (24h)</strong>
          <small className={styles.metaMuted}>
            Last 7 days: {Number(reports?.playback_failures_7d || 0)} / Attempts: {Number(reports?.playback_attempts_7d || 0)}
          </small>
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
          <h2>User Arrival Trend</h2>
          <p className={styles.hint}>Login trend grouped by day, week, month, and year.</p>
          <div className={styles.trendGrid}>
            {trendPanels.map((panel) => {
              const values = panel.data.map((row) => Number(row?.value || 0));
              const total = values.reduce((sum, value) => sum + value, 0);
              const chart = buildSmoothLineModel(values, 760, 280);
              const activePoint = chart.points[chart.activeIndex] || null;
              const midIdx = panel.data.length > 1 ? Math.floor(panel.data.length / 2) : 0;
              const tipW = 110;
              const tipH = 62;
              const tipX = activePoint ? Math.max(chart.pad.left + 8, Math.min(activePoint.x + 12, chart.width - tipW - 6)) : chart.pad.left + 12;
              const tipY = activePoint ? Math.max(chart.pad.top + 6, activePoint.y - tipH - 10) : chart.pad.top + 10;
              const head = panel.data[0];
              const tail = panel.data[panel.data.length - 1];
              return (
                <div key={panel.key} className={styles.trendPanel}>
                  <div className={styles.trendPanelHead}>
                    <p>{panel.title}</p>
                    <strong>{formatShortCount(total)}</strong>
                  </div>
                  <svg viewBox={`0 0 ${chart.width} ${chart.height}`} className={styles.trendSvg} aria-hidden="true">
                    {Array.from({ length: 6 }).map((_, i) => {
                      const y = chart.pad.top + ((chart.height - chart.pad.top - chart.pad.bottom) * i) / 5;
                      const val = Math.round(chart.yMax - (chart.yMax * i) / 5);
                      return (
                        <g key={`gy-${i}`}>
                          <line x1={chart.pad.left} y1={y} x2={chart.width - chart.pad.right} y2={y} className={styles.trendGridLine} />
                          <text x={chart.pad.left - 8} y={y + 4} className={styles.trendAxisLabel} textAnchor="end">{val}</text>
                        </g>
                      );
                    })}
                    <line x1={chart.pad.left} y1={chart.pad.top} x2={chart.pad.left} y2={chart.height - chart.pad.bottom} className={styles.trendAxisLine} />
                    <line x1={chart.pad.left} y1={chart.height - chart.pad.bottom} x2={chart.width - chart.pad.right} y2={chart.height - chart.pad.bottom} className={styles.trendAxisLine} />
                    {activePoint ? (
                      <line
                        x1={activePoint.x}
                        y1={chart.pad.top}
                        x2={activePoint.x}
                        y2={chart.height - chart.pad.bottom}
                        className={styles.trendActiveGuide}
                      />
                    ) : null}
                    <path d={chart.area} className={styles.trendArea} />
                    <path d={chart.path} className={styles.trendLine} />
                    {chart.points.map((p, idx) => (
                      <circle
                        key={`pt-${idx}`}
                        cx={p.x}
                        cy={p.y}
                        r={idx === chart.activeIndex ? 5.5 : 4}
                        className={idx === chart.activeIndex ? styles.trendPointActive : styles.trendPoint}
                      />
                    ))}
                    {activePoint ? (
                      <g>
                        <rect x={tipX} y={tipY} width={tipW} height={tipH} rx={8} className={styles.trendTooltipBox} />
                        <text x={tipX + 10} y={tipY + 20} className={styles.trendTooltipLabel}>
                          {panel.data[chart.activeIndex]?.label || `#${chart.activeIndex + 1}`}
                        </text>
                        <line x1={tipX} y1={tipY + 30} x2={tipX + tipW} y2={tipY + 30} className={styles.trendTooltipDivider} />
                        <text x={tipX + 10} y={tipY + 50} className={styles.trendTooltipValue}>{activePoint.value}</text>
                      </g>
                    ) : null}
                    <text x={chart.pad.left} y={chart.height - 10} className={styles.trendAxisLabel}>{head?.label || "-"}</text>
                    <text x={(chart.pad.left + chart.width - chart.pad.right) / 2} y={chart.height - 10} className={styles.trendAxisLabel} textAnchor="middle">
                      {panel.data[midIdx]?.label || "-"}
                    </text>
                    <text x={chart.width - chart.pad.right} y={chart.height - 10} className={styles.trendAxisLabel} textAnchor="end">{tail?.label || "-"}</text>
                  </svg>
                  <div className={styles.trendPanelFoot}>
                    <span>{head?.label || "-"}</span>
                    <span>Peak: {activePoint?.value ?? 0}</span>
                    <span>{tail?.label || "-"}</span>
                  </div>
                </div>
              );
            })}
          </div>
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
          <h2>Announcements</h2>
          <p className={styles.hint}>Post updates, maintenance notices, and featured articles.</p>
          <Link href="/dashboard/announcements" className={styles.navCta}>Open Announcements</Link>
        </article>
        <article className={styles.card}>
          <h2>Local Check</h2>
          <p className={styles.hint}>Run Local IP/ISP check with progress + live preview.</p>
          <Link href="/dashboard/local-check" className={styles.navCta}>Open Local Check</Link>
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
        </div>
      </details>
    </>
  );
}
