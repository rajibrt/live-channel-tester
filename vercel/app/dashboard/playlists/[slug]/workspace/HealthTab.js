"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Activity, RefreshCw } from "lucide-react";
import styles from "../../workspace.module.css";
import ChannelDrawer from "./ChannelDrawer";
import { normalizeGroup } from "./groupUtils";

function isDead(c) {
  return String(c?.status || "").toUpperCase() === "DEAD";
}

function ago(value) {
  const t = new Date(value || "").getTime();
  if (!t) return "—";
  const mins = Math.round((Date.now() - t) / 60000);
  if (mins < 60) return `${Math.max(1, mins)} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.round(hours / 24)} days ago`;
}

async function healthAction(playlistSlug, body) {
  const res = await fetch(`/api/admin/playlists/${encodeURIComponent(playlistSlug)}/health-actions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || "Action failed.");
  return json;
}

export default function HealthTab({ playlistSlug, channels, setChannels, groups, setSavedGroups, setSourceCounts }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [drawerId, setDrawerId] = useState(null);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/playlists/${encodeURIComponent(playlistSlug)}/health`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Could not load health data.");
      setStats(json);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playlistSlug]);

  const dead = useMemo(() => channels.filter(isDead), [channels]);
  const problems = useMemo(() => {
    const s = stats?.stats || {};
    return channels
      .map((c) => ({ channel: c, st: s[String(c.id)] }))
      .filter(({ st }) => st && st.fail >= 3 && st.fail >= st.ok)
      .sort((a, b) => b.st.fail - a.st.fail)
      .slice(0, 100);
  }, [channels, stats]);
  const reported = useMemo(() => {
    const s = stats?.stats || {};
    return Object.values(s).filter((st) => st.ok || st.fail).length;
  }, [stats]);
  const singleLink = useMemo(() => {
    const s = stats?.stats || {};
    return channels.filter((c) => !isDead(c) && Number(s[String(c.id)]?.active || 1) <= 1).length;
  }, [channels, stats]);

  const act = async (ids, kind) => {
    if (!ids.length) return;
    if (kind === "remove" && !window.confirm(`Remove ${ids.length} channel(s) from this playlist? This cannot be undone.`)) return;
    setBusy(true);
    setError("");
    try {
      const body = kind === "live" ? { enable_ids: ids } : kind === "dead" ? { disable_ids: ids } : { delete_ids: ids };
      await healthAction(playlistSlug, body);
      const set = new Set(ids.map(Number));
      if (kind === "remove") setChannels((prev) => prev.filter((c) => !set.has(Number(c.id))));
      else setChannels((prev) => prev.map((c) => (set.has(Number(c.id)) ? { ...c, status: kind === "live" ? "LIVE" : "DEAD" } : c)));
      setMessage(`${ids.length} channel(s) ${kind === "remove" ? "removed" : `marked ${kind === "live" ? "LIVE" : "DEAD"}`}.`);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const drawerChannel = drawerId ? channels.find((c) => Number(c.id) === Number(drawerId)) : null;

  return (
    <div className={styles.listPanel}>
      <dl className={styles.healthStats}>
        <div>
          <dt>Live</dt>
          <dd className={styles.good}>{channels.length - dead.length}</dd>
        </div>
        <div>
          <dt>Dead</dt>
          <dd className={dead.length ? styles.bad : ""}>{dead.length}</dd>
        </div>
        <div>
          <dt>Failing for viewers</dt>
          <dd className={problems.length ? styles.bad : ""}>{loading ? "…" : problems.length}</dd>
        </div>
        <div>
          <dt>Only one link</dt>
          <dd>{loading ? "…" : singleLink}</dd>
        </div>
      </dl>

      <div className={styles.toolbar}>
        <button type="button" className={styles.ghostBtn} onClick={load} disabled={loading}>
          <RefreshCw size={14} />
          Refresh viewer data
        </button>
        <Link href={`/dashboard/playlists/${encodeURIComponent(playlistSlug)}/live-check`} className={styles.ghostBtn}>
          <Activity size={14} />
          Run full live check
        </Link>
        <span className={styles.muted}>
          {stats?.available === false
            ? "Viewer data is not available yet."
            : `Viewer reports cover ${reported} channel(s). Updated ${ago(stats?.generated_at)}.`}
        </span>
      </div>
      {message ? <p className={styles.notice}>{message}</p> : null}
      {error ? <p className={styles.errorText}>{error}</p> : null}

      <section className={styles.healthSection}>
        <div className={styles.sectionHead}>
          <h3>Failing for viewers</h3>
          <p className={styles.muted}>
            Channels whose links failed more often than they played in viewers&apos; players (at least 3 failures). Add a backup link
            or mark them dead.
          </p>
        </div>
        {problems.length ? (
          <ul className={styles.channelList}>
            {problems.map(({ channel: c, st }) => (
              <li key={c.id} className={styles.healthRow}>
                <button type="button" className={styles.channelMain} onClick={() => setDrawerId(c.id)}>
                  <span className={styles.channelName}>{c.name}</span>
                  <span className={styles.channelMeta}>
                    {normalizeGroup(c.category)} · {st.active} active link{st.active === 1 ? "" : "s"}
                  </span>
                </button>
                <span className={styles.channelMeta}>
                  <span className={styles.bad}>{st.fail} failed</span> · {st.ok} played · last failure {ago(st.lastFailureAt)}
                </span>
                <span className={styles.rowActions}>
                  <button type="button" className={styles.ghostBtn} onClick={() => setDrawerId(c.id)}>
                    Links
                  </button>
                  <button type="button" className={styles.ghostBtn} disabled={busy || isDead(c)} onClick={() => act([Number(c.id)], "dead")}>
                    Mark dead
                  </button>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.muted}>{loading ? "Loading…" : "No channel is failing for viewers right now."}</p>
        )}
      </section>

      <section className={styles.healthSection}>
        <div className={styles.sectionHead}>
          <h3>Dead channels ({dead.length})</h3>
          <p className={styles.muted}>Dead channels are hidden from viewers. Mark one live again after fixing its links, or remove it.</p>
        </div>
        {dead.length ? (
          <>
            <div className={styles.toolbar}>
              <button type="button" className={styles.ghostBtn} disabled={busy} onClick={() => act(dead.map((c) => Number(c.id)), "live")}>
                Mark all live
              </button>
              <button type="button" className={styles.dangerBtn} disabled={busy} onClick={() => act(dead.map((c) => Number(c.id)), "remove")}>
                Remove all dead
              </button>
            </div>
            <ul className={styles.channelList}>
              {dead.map((c) => (
                <li key={c.id} className={styles.healthRow}>
                  <button type="button" className={styles.channelMain} onClick={() => setDrawerId(c.id)}>
                    <span className={styles.channelName}>{c.name}</span>
                    <span className={styles.channelMeta}>{normalizeGroup(c.category)}</span>
                  </button>
                  <span className={styles.channelMeta}>{String(c.stream_url || "").slice(0, 70)}</span>
                  <span className={styles.rowActions}>
                    <button type="button" className={styles.ghostBtn} onClick={() => setDrawerId(c.id)}>
                      Edit
                    </button>
                    <button type="button" className={styles.ghostBtn} disabled={busy} onClick={() => act([Number(c.id)], "live")}>
                      Mark live
                    </button>
                    <button type="button" className={styles.dangerBtn} disabled={busy} onClick={() => act([Number(c.id)], "remove")}>
                      Remove
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className={styles.muted}>No dead channels.</p>
        )}
      </section>

      {drawerChannel ? (
        <ChannelDrawer
          mode="edit"
          channel={drawerChannel}
          playlistSlug={playlistSlug}
          groupNames={groups.map((g) => g.name)}
          onClose={() => setDrawerId(null)}
          onChannelSaved={(updated) => {
            setChannels((prev) => prev.map((c) => (Number(c.id) === Number(updated.id) ? { ...c, ...updated } : c)));
            if (updated.category) setSavedGroups((prev) => (prev.includes(updated.category) ? prev : [...prev, updated.category]));
          }}
          onLinksSaved={(json) => {
            const list = Array.isArray(json?.sources) ? json.sources : [];
            if (json?.channel?.id) {
              setSourceCounts((prev) => ({
                ...prev,
                [String(json.channel.id)]: { total: list.length, active: list.filter((s) => s?.is_active !== false).length },
              }));
              setChannels((prev) =>
                prev.map((c) => (Number(c.id) === Number(json.channel.id) ? { ...c, stream_url: json.channel.stream_url } : c))
              );
            }
          }}
        />
      ) : null}
    </div>
  );
}
