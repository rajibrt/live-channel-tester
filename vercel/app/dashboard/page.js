import Link from "next/link";
import { getSupabaseAdmin } from "../../lib/supabaseAdmin";
import { getActiveViewerSnapshot } from "../../lib/activeViewers";
import styles from "./page.module.css";
import CopyUrlButton from "./CopyUrlButton";
import ActiveViewersPanel from "./ActiveViewersPanel";

async function getData() {
  const supabase = getSupabaseAdmin();
  const [{ data: playlists }, { data: tokens }, { data: jobRun }, activeViewers] = await Promise.all([
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
  ]);
  const tokenBySlug = Object.fromEntries((tokens || []).map((t) => [t.playlist_slug, t.token]));
  return { playlists: playlists || [], tokenBySlug, jobRun: jobRun || null, activeViewers };
}

export default async function DashboardPage() {
  const { playlists, tokenBySlug, jobRun, activeViewers } = await getData();
  const base = process.env.PUBLIC_PLAYLIST_BASE_URL || "";
  const activeTokenCount = Object.keys(tokenBySlug).length;
  const lastRunText = jobRun?.last_run_at
    ? new Date(jobRun.last_run_at).toLocaleString()
    : "Not run yet";
  const cronEnabled = typeof jobRun?.is_enabled === "boolean" ? jobRun.is_enabled : true;
  const cronOk = cronEnabled && String(jobRun?.last_status || "").toLowerCase() === "ok";

  return (
    <>
      <section className={styles.stats}>
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

      <section className={`${styles.card} ${styles.tableCard}`}>
        <h2>Playlists</h2>
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
      </section>
    </>
  );
}
