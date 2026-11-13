import Link from "next/link";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  CheckCircle2,
  Clapperboard,
  Link2,
  ListVideo,
  Radio,
  Tv,
  UserCheck,
  Activity,
} from "lucide-react";
import { getSupabaseAdmin } from "../../lib/supabaseAdmin";
import { getActiveViewerSnapshot } from "../../lib/activeViewers";
import { getDashboardReports } from "../../lib/dashboardReports";
import { requireAdmin } from "../../lib/auth";
import base from "./page.module.css";
import styles from "./overview.module.css";
import ActiveViewersPanel from "./ActiveViewersPanel";
import UserArrivalTrendCharts from "./UserArrivalTrendCharts";

async function getData() {
  const supabase = getSupabaseAdmin();
  const [{ data: playlists }, { count: activeTokens }, { data: jobRun }, { data: pushRows }, activeViewers, reports] = await Promise.all([
    supabase.from("playlists").select("slug,name,channel_count").order("updated_at", { ascending: false }),
    supabase.from("playlist_tokens").select("token", { count: "exact", head: true }).eq("is_active", true),
    supabase
      .from("job_runs")
      .select("last_run_at,last_status,is_enabled")
      .eq("job_name", "playlist_health_hourly")
      .maybeSingle(),
    supabase.from("client_push_subscriptions").select("user_id").eq("is_active", true).limit(10000),
    getActiveViewerSnapshot(),
    getDashboardReports(),
  ]);
  const pushUsers = new Set((pushRows || []).map((row) => String(row?.user_id || "")).filter(Boolean)).size;
  return { playlists: playlists || [], activeTokens: Number(activeTokens || 0), jobRun: jobRun || null, pushUsers, activeViewers, reports };
}

function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Math.round(Number(totalSeconds || 0)));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${seconds}s`;
}

function formatCount(value) {
  return Number(value || 0).toLocaleString("en-US");
}

function timeAgo(value) {
  const at = new Date(value || "");
  if (Number.isNaN(at.getTime())) return "-";
  const minutes = Math.max(0, Math.round((Date.now() - at.getTime()) / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

// Change against the previous period. `lowerIsBetter` flips the colour.
function Delta({ current, previous, lowerIsBetter = false, points = false }) {
  const cur = Number(current || 0);
  const prev = Number(previous || 0);
  if (!prev && !cur) return <span className={styles.deltaFlat}>No change</span>;
  if (!prev) return <span className={lowerIsBetter ? styles.deltaBad : styles.deltaGood}>New</span>;
  const diff = points ? cur - prev : ((cur - prev) / prev) * 100;
  if (Math.abs(diff) < 0.5) return <span className={styles.deltaFlat}>No change</span>;
  const up = diff > 0;
  const good = lowerIsBetter ? !up : up;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  const label = points
    ? `${Math.abs(diff).toFixed(1)} pts`
    : Math.abs(diff) >= 1000 ? ">999%" : `${Math.round(Math.abs(diff))}%`;
  return (
    <span className={good ? styles.deltaGood : styles.deltaBad}>
      <Icon size={13} aria-hidden="true" />
      {label}
    </span>
  );
}

function Kpi({ label, value, delta, sub }) {
  return (
    <article className={styles.kpi}>
      <p className={styles.kpiLabel}>{label}</p>
      <strong className={styles.kpiValue}>{value}</strong>
      <div className={styles.kpiFoot}>
        {delta}
        {sub ? <span className={styles.kpiSub}>{sub}</span> : null}
      </div>
    </article>
  );
}

function Thumb({ src, alt, fallback, poster = false }) {
  return (
    <span className={poster ? styles.poster : styles.thumb} aria-hidden="true">
      {src ? <img src={src} alt={alt} loading="lazy" /> : <span>{fallback}</span>}
    </span>
  );
}

function initials(name) {
  return String(name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function RankList({ rows, empty, render }) {
  if (!rows.length) return <p className={styles.empty}>{empty}</p>;
  const max = Math.max(...rows.map((row) => row.metric), 1);
  return (
    <ol className={styles.rankList}>
      {rows.map((row, index) => {
        const item = render(row);
        return (
          <li key={item.key} className={styles.rankRow}>
            <span className={styles.rankNo}>{index + 1}</span>
            {item.thumb}
            <span className={styles.rankBody}>
              <span className={styles.rankName} title={item.name}>{item.name}</span>
              {item.meta ? <span className={styles.rankMeta}>{item.meta}</span> : null}
              <span className={styles.rankBar} aria-hidden="true">
                <span style={{ width: `${Math.max(6, Math.round((row.metric / max) * 100))}%` }} />
              </span>
            </span>
            <span className={styles.rankValue}>{item.value}</span>
          </li>
        );
      })}
    </ol>
  );
}

export default async function DashboardPage() {
  // Layout and page render in parallel; check auth here too so the report
  // queries never run for signed-out visitors.
  await requireAdmin();
  const { playlists, activeTokens, jobRun, pushUsers, activeViewers, reports } = await getData();
  const { kpi, users, link_health: health, radio, totals } = reports;
  const healthSlug = health.primary_playlist || playlists[0]?.slug || "";
  const healthHref = healthSlug ? `/dashboard/playlists/${healthSlug}?tab=health` : "/dashboard/playlists";

  const attention = [];
  if (users.pending > 0) {
    attention.push({ key: "pending", tone: "warn", icon: UserCheck, text: `${users.pending} sign-up${users.pending === 1 ? "" : "s"} waiting for approval`, href: "/dashboard/clients" });
  }
  if (health.failing_channels > 0) {
    attention.push({ key: "failing", tone: "bad", icon: AlertTriangle, text: `${health.failing_channels} channel${health.failing_channels === 1 ? "" : "s"} failing for viewers`, href: healthHref });
  }
  if (health.dead_channels > 0) {
    attention.push({ key: "dead", tone: "warn", icon: Tv, text: `${health.dead_channels} dead channel${health.dead_channels === 1 ? "" : "s"} hidden from viewers`, href: healthHref });
  }
  if (health.single_link_channels > 0) {
    attention.push({ key: "single", tone: "info", icon: Link2, text: `${formatCount(health.single_link_channels)} channels have no backup link`, href: healthHref });
  }

  const trend = reports.viewer_trend;
  const trendPanels = [
    { key: "day", title: "24h", unit: "hour", data: trend.day },
    { key: "week", title: "7d", unit: "day", data: trend.week },
    { key: "month", title: "30d", unit: "day", data: trend.month },
    { key: "year", title: "12m", unit: "month", data: trend.year },
  ];

  const cronOn = Boolean(jobRun?.is_enabled);
  const totalChannels = playlists.reduce((sum, p) => sum + (Number(p.channel_count) || 0), 0);
  const loginTotal = users.logins_24h || 0;

  return (
    <div className={styles.overview}>
      <section className={styles.attention} aria-label="Needs attention">
        {attention.length ? (
          attention.map(({ key, tone, icon: Icon, text, href }) => (
            <Link key={key} href={href} className={`${styles.attentionItem} ${styles[`tone_${tone}`]}`}>
              <Icon size={15} aria-hidden="true" />
              <span>{text}</span>
            </Link>
          ))
        ) : (
          <span className={`${styles.attentionItem} ${styles.tone_ok}`}>
            <CheckCircle2 size={15} aria-hidden="true" />
            <span>All clear: no pending sign-ups or failing channels</span>
          </span>
        )}
      </section>

      <section className={styles.kpiGrid} aria-label="Key numbers">
        <ActiveViewersPanel
          title="Watching now"
          viewers={activeViewers?.viewers || []}
          className={`${styles.kpi} ${styles.kpiButton}`}
          labelClassName={styles.kpiLabel}
          valueClassName={styles.kpiValue}
          hintClassName={styles.kpiSub}
        />
        <Kpi
          label="Active viewers · 24h"
          value={formatCount(kpi.active_viewers_24h.current)}
          delta={<Delta {...kpi.active_viewers_24h} />}
          sub="vs previous 24h"
        />
        <Kpi
          label="Watch time · 24h"
          value={formatDuration(kpi.watch_seconds_24h.current)}
          delta={<Delta {...kpi.watch_seconds_24h} />}
          sub="live TV"
        />
        <Kpi
          label="Plays · 24h"
          value={formatCount(kpi.plays_24h.current)}
          delta={<Delta {...kpi.plays_24h} />}
          sub="TV + movies"
        />
        <Kpi
          label="Failure rate · 24h"
          value={`${kpi.failure_rate_24h.current}%`}
          delta={<Delta {...kpi.failure_rate_24h} lowerIsBetter points />}
          sub="of TV plays"
        />
        <Kpi
          label="New users · 7d"
          value={formatCount(kpi.new_users_7d.current)}
          delta={<Delta {...kpi.new_users_7d} />}
          sub="vs previous 7d"
        />
      </section>

      <section className={styles.mainGrid}>
        <article className={styles.panel}>
          <header className={styles.panelHead}>
            <div>
              <h2>Viewers</h2>
              <p>Unique signed-in viewers</p>
            </div>
          </header>
          <UserArrivalTrendCharts trendPanels={trendPanels} />
        </article>

        <article className={styles.panel}>
          <header className={styles.panelHead}>
            <div>
              <h2>Users</h2>
              <p>{formatCount(users.total)} accounts</p>
            </div>
            <Link href="/dashboard/clients" className={styles.panelLink}>Clients</Link>
          </header>
          <dl className={styles.facts}>
            <div><dt>Approved</dt><dd>{formatCount(users.approved)}</dd></div>
            <div><dt>Pending</dt><dd className={users.pending ? styles.factWarn : undefined}>{formatCount(users.pending)}</dd></div>
            <div><dt>Facebook sign-ups</dt><dd>{formatCount(users.facebook)}</dd></div>
            <div><dt><Bell size={13} aria-hidden="true" /> Push enabled</dt><dd>{formatCount(pushUsers)}</dd></div>
          </dl>
          <h3 className={styles.subHead}>Sign-ins · 24h <span>{loginTotal}</span></h3>
          {users.login_methods_24h.length ? (
            <div className={styles.splitBar} aria-hidden="true">
              {users.login_methods_24h.map(([method, count], index) => (
                <span key={method} className={styles[`seg${(index % 4) + 1}`]} style={{ flexGrow: count }} />
              ))}
            </div>
          ) : null}
          <ul className={styles.legend}>
            {users.login_methods_24h.length ? (
              users.login_methods_24h.map(([method, count], index) => (
                <li key={method}>
                  <span className={`${styles.legendDot} ${styles[`seg${(index % 4) + 1}`]}`} />
                  {method.replace(/_/g, " ")}
                  <strong>{count}</strong>
                </li>
              ))
            ) : (
              <li className={styles.empty}>No sign-ins in the last 24 hours.</li>
            )}
          </ul>
          <h3 className={styles.subHead}>All time</h3>
          <dl className={styles.facts}>
            <div><dt>Sign-ins</dt><dd>{formatCount(totals.logins)}</dd></div>
            <div><dt>TV plays</dt><dd>{formatCount(totals.playback_attempts)}</dd></div>
          </dl>
        </article>
      </section>

      <section className={styles.topGrid} aria-label="Top content">
        <article className={styles.panel}>
          <header className={styles.panelHead}>
            <div>
              <h2><Tv size={16} aria-hidden="true" /> Top channels</h2>
              <p>Watch time, last 7 days</p>
            </div>
          </header>
          <RankList
            rows={reports.top_channels_7d.map((row) => ({ ...row, metric: row.watch_seconds }))}
            empty="No watch history in the last 7 days."
            render={(row) => ({
              key: row.channel_id,
              name: row.channel_name,
              meta: `${row.viewers} viewer${row.viewers === 1 ? "" : "s"}`,
              value: formatDuration(row.watch_seconds),
              thumb: <Thumb src={row.logo_url} alt="" fallback={initials(row.channel_name)} />,
            })}
          />
        </article>

        <article className={styles.panel}>
          <header className={styles.panelHead}>
            <div>
              <h2><Clapperboard size={16} aria-hidden="true" /> Top movies</h2>
              <p>Viewers, last 7 days · {formatCount(totals.published_movies)} published</p>
            </div>
            <Link href="/dashboard/movies" className={styles.panelLink}>Movies</Link>
          </header>
          <RankList
            rows={reports.top_movies_7d.map((row) => ({ ...row, metric: row.viewers }))}
            empty="No movie plays in the last 7 days."
            render={(row) => ({
              key: row.movie_id,
              name: row.title,
              meta: [row.release_year, `${row.plays} play${row.plays === 1 ? "" : "s"}`].filter(Boolean).join(" · "),
              value: `${row.viewers}`,
              thumb: <Thumb src={row.poster_url} alt="" fallback={initials(row.title)} poster />,
            })}
          />
        </article>

        <article className={styles.panel}>
          <header className={styles.panelHead}>
            <div>
              <h2><Radio size={16} aria-hidden="true" /> Top radio</h2>
              <p>
                {radio.available
                  ? `Plays since launch · ${radio.listened_24h} of ${radio.stations} stations played today`
                  : "Radio tables not found"}
              </p>
            </div>
            <Link href="/dashboard/radio" className={styles.panelLink}>Radio</Link>
          </header>
          <RankList
            rows={(radio.top || []).map((row) => ({ ...row, metric: row.plays }))}
            empty="No radio plays recorded yet."
            render={(row) => ({
              key: row.id,
              name: row.name,
              meta: row.frequency,
              value: formatCount(row.plays),
              thumb: <Thumb src={row.logo_url} alt="" fallback={initials(row.name)} />,
            })}
          />
        </article>
      </section>

      <section className={styles.reliabilityGrid} aria-label="Reliability">
        <article className={styles.panel}>
          <header className={styles.panelHead}>
            <div>
              <h2>Failed plays by channel</h2>
              <p>Player errors reported by viewers, last 7 days</p>
            </div>
          </header>
          {reports.failed_channels_7d.length ? (
            <div className={base.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Channel</th>
                    <th>Failed</th>
                    <th>Tries</th>
                    <th>Rate</th>
                    <th>Last failure</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.failed_channels_7d.map((row) => (
                    <tr key={row.channel_id}>
                      <td className={styles.cellName}>{row.channel_name}</td>
                      <td>{row.failures}</td>
                      <td>{row.attempts}</td>
                      <td>
                        <span className={row.failure_rate_pct >= 50 ? styles.rateBad : row.failure_rate_pct >= 20 ? styles.rateWarn : styles.rateOk}>
                          {row.failure_rate_pct}%
                        </span>
                      </td>
                      <td className={styles.cellMuted}>{timeAgo(row.last_failed_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className={styles.empty}>No failed plays in the last 7 days.</p>
          )}
        </article>

        <article className={styles.panel}>
          <header className={styles.panelHead}>
            <div>
              <h2>Link health</h2>
              <p>From viewer playback results on every link</p>
            </div>
            <Link href={healthHref} className={styles.panelLink}>Health</Link>
          </header>
          <dl className={styles.healthStats}>
            <div><dt>Live</dt><dd className={styles.factOk}>{formatCount(health.live_channels)}</dd></div>
            <div><dt>Dead</dt><dd className={health.dead_channels ? styles.factWarn : undefined}>{formatCount(health.dead_channels)}</dd></div>
            <div><dt>Failing</dt><dd className={health.failing_channels ? styles.factBad : undefined}>{formatCount(health.failing_channels)}</dd></div>
            <div><dt>One link only</dt><dd>{formatCount(health.single_link_channels)}</dd></div>
          </dl>
          <h3 className={styles.subHead}>Failing for viewers</h3>
          {health.failing_list.length ? (
            <ul className={styles.failList}>
              {health.failing_list.map((row) => (
                <li key={row.channel_id}>
                  <Thumb src={row.logo_url} alt="" fallback={initials(row.channel_name)} />
                  <span className={styles.rankBody}>
                    <span className={styles.rankName}>{row.channel_name}</span>
                    <span className={styles.rankMeta}>
                      {row.failures} failed · {row.plays} played · {row.playlist_slug}
                    </span>
                  </span>
                  <span className={styles.cellMuted}>{timeAgo(row.last_failed_at)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.empty}>No channel is failing for viewers.</p>
          )}
        </article>
      </section>

      <section className={styles.systemStrip} aria-label="Library and system">
        <Link href="/dashboard/playlists" className={styles.systemItem}>
          <ListVideo size={15} aria-hidden="true" />
          <span><strong>{playlists.length}</strong> playlists · <strong>{formatCount(totalChannels)}</strong> channel slots · <strong>{activeTokens}</strong> active M3U link{activeTokens === 1 ? "" : "s"}</span>
        </Link>
        <Link href="/dashboard/movies" className={styles.systemItem}>
          <Clapperboard size={15} aria-hidden="true" />
          <span><strong>{formatCount(totals.published_movies)}</strong> movies</span>
        </Link>
        <Link href="/dashboard/radio" className={styles.systemItem}>
          <Radio size={15} aria-hidden="true" />
          <span><strong>{radio.stations || 0}</strong> radio stations</span>
        </Link>
        <span className={styles.systemItem}>
          <Activity size={15} aria-hidden="true" />
          <span>
            Server auto-check: <strong>{cronOn ? "On" : "Off"}</strong>
            {jobRun?.last_run_at ? ` · last run ${new Date(jobRun.last_run_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}` : ""}
          </span>
          <form method="post" action="/api/admin/cron/toggle" className={styles.inlineForm}>
            <input type="hidden" name="enabled" value={cronOn ? "false" : "true"} />
            <button type="submit" className={styles.tinyBtn}>{cronOn ? "Turn off" : "Turn on"}</button>
          </form>
        </span>
      </section>
    </div>
  );
}
