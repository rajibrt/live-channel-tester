import Link from "next/link";
import { getSupabaseAdmin } from "../../lib/supabaseAdmin";
import styles from "./page.module.css";
import AdminHeader from "./AdminHeader";
import CopyUrlButton from "./CopyUrlButton";

async function getData() {
  const supabase = getSupabaseAdmin();
  const { data: playlists } = await supabase
    .from("playlists")
    .select("slug,name,channel_count,updated_at")
    .order("updated_at", { ascending: false });
  const { data: tokens } = await supabase
    .from("playlist_tokens")
    .select("playlist_slug,token,is_active")
    .eq("is_active", true);
  const { data: jobRun } = await supabase
    .from("job_runs")
    .select("job_name,last_run_at,last_status,last_message,last_total,last_live,last_dead")
    .eq("job_name", "playlist_health_hourly")
    .maybeSingle();
  const tokenBySlug = Object.fromEntries((tokens || []).map((t) => [t.playlist_slug, t.token]));
  return { playlists: playlists || [], tokenBySlug, jobRun: jobRun || null };
}

export default async function DashboardPage() {
  const { playlists, tokenBySlug, jobRun } = await getData();
  const base = process.env.PUBLIC_PLAYLIST_BASE_URL || "";
  const activeTokenCount = Object.keys(tokenBySlug).length;
  const lastRunText = jobRun?.last_run_at
    ? new Date(jobRun.last_run_at).toLocaleString()
    : "Not run yet";
  const cronOk = String(jobRun?.last_status || "").toLowerCase() === "ok";

  return (
    <main className={styles.page}>
      <div className={styles.bgGlow} />
      <section className={styles.shell}>
        <AdminHeader
          title="Dashboard"
          subtitle="Use the menu to open each function on its own route."
        />

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
            <h2>Local Check</h2>
            <p className={styles.hint}>Run Local IP/ISP check with progress + live preview.</p>
            <Link href="/dashboard/local-check" className={styles.navCta}>Open Local Check</Link>
          </article>
          <article className={styles.card}>
            <h2>Last Cron Run</h2>
            <p className={styles.hint}>Hourly playlist health auto-check status.</p>
            <p className={styles.metaLine}>
              <span className={`${styles.statusDot} ${cronOk ? styles.statusLive : styles.statusDead}`} aria-hidden="true" />
              <strong>{lastRunText}</strong>
            </p>
            <p className={styles.metaLine}>
              Total: <strong>{Number(jobRun?.last_total || 0)}</strong> | LIVE:{" "}
              <strong>{Number(jobRun?.last_live || 0)}</strong> | DEAD:{" "}
              <strong>{Number(jobRun?.last_dead || 0)}</strong>
            </p>
            {jobRun?.last_message ? <p className={styles.hint}>{jobRun.last_message}</p> : null}
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
      </section>
    </main>
  );
}
