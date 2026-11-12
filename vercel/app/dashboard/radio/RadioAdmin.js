"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Pencil, Play, Plus, Radio, Trash2, X } from "lucide-react";
import ws from "../playlists/workspace.module.css";
import styles from "./radio-admin.module.css";
import { resolveBrowserPlaybackUrl } from "../../../lib/streamUrl";

const EMPTY = { name: "", name_bn: "", band: "FM", frequency: "", city: "", logo_url: "", is_active: true };

async function api(path, options = {}) {
  const res = await fetch(path, { headers: { "content-type": "application/json" }, ...options });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || `Request failed (${res.status}).`);
  return json;
}

function freqLabel(s) {
  if (s.band === "Online" || s.frequency === null || s.frequency === undefined || s.frequency === "") return "Online";
  return s.band === "AM" ? `${Number(s.frequency)} kHz AM` : `${Number(s.frequency).toFixed(1)} MHz`;
}

function initials(name) {
  return String(name || "?").split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

// Plays a link in a hidden audio element for up to 10 s. HLS links need hls.js, so they are
// only checked for a reachable playlist here; the real player handles them.
function testLink(url) {
  return new Promise((resolve) => {
    const src = resolveBrowserPlaybackUrl(url, window.location.protocol);
    if (/\.m3u8(\?|$)/i.test(url)) {
      fetch(src, { method: "GET" })
        .then((r) => r.text().then((t) => resolve(r.ok && t.includes("#EXTM3U") ? { ok: true, note: "HLS playlist found" } : { ok: false, note: `HTTP ${r.status}` })))
        .catch(() => resolve({ ok: false, note: "Not reachable from this browser" }));
      return;
    }
    const audio = new Audio();
    audio.muted = true;
    audio.preload = "none";
    const done = (result) => {
      clearTimeout(timer);
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      resolve(result);
    };
    const timer = setTimeout(() => done({ ok: false, note: "No sound within 10 s" }), 10000);
    audio.addEventListener("playing", () => done({ ok: true, note: "Plays" }), { once: true });
    audio.addEventListener("error", () => done({ ok: false, note: "Failed to load" }), { once: true });
    audio.src = src;
    audio.play().catch(() => {});
  });
}

function StationDrawer({ station, onClose, onSaved }) {
  const isNew = !station?.id;
  const [form, setForm] = useState(() => ({ ...EMPTY, ...(station || {}), frequency: station?.frequency ?? "" }));
  const [links, setLinks] = useState([]);
  const [newUrl, setNewUrl] = useState("");
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [tests, setTests] = useState({});

  useEffect(() => {
    if (isNew) return;
    let cancelled = false;
    api(`/api/admin/radio/${station.id}/sources`)
      .then((json) => !cancelled && setLinks((json.sources || []).map((s) => ({ ...s, key: `${s.id}` }))))
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [isNew, station?.id]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const move = (i, d) =>
    setLinks((list) => {
      const j = i + d;
      if (j < 0 || j >= list.length) return list;
      const next = [...list];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  const addLink = () => {
    const url = newUrl.trim();
    if (!/^https?:\/\//i.test(url)) {
      setError("Paste a link that starts with http:// or https://");
      return;
    }
    if (links.some((l) => l.stream_url.toLowerCase() === url.toLowerCase())) {
      setError("This link is already in the list.");
      return;
    }
    setError("");
    setLinks((list) => [...list, { key: `new-${Date.now()}`, stream_url: url, label: "", is_active: true, success_count: 0, failure_count: 0 }]);
    setNewUrl("");
  };
  const runTest = async (link) => {
    setTests((t) => ({ ...t, [link.key]: { running: true } }));
    const result = await testLink(link.stream_url);
    setTests((t) => ({ ...t, [link.key]: result }));
  };

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const payload = { ...form, frequency: form.band === "Online" ? "" : form.frequency };
      const sources = links.map((l) => ({ stream_url: l.stream_url, label: l.label, is_active: l.is_active }));
      if (isNew) {
        await api("/api/admin/radio", { method: "POST", body: JSON.stringify({ ...payload, sources }) });
      } else {
        await api(`/api/admin/radio/${station.id}`, { method: "PATCH", body: JSON.stringify(payload) });
        await api(`/api/admin/radio/${station.id}/sources`, { method: "PUT", body: JSON.stringify({ sources }) });
      }
      onSaved(isNew ? `Added ${form.name}.` : `Saved ${form.name}.`);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={ws.drawerWrap} role="dialog" aria-modal="true" aria-labelledby="radio-drawer-title">
      <div className={ws.drawer}>
        <div className={ws.drawerHead}>
          <Radio size={18} />
          <h3 id="radio-drawer-title">{isNew ? "Add radio station" : form.name || "Edit station"}</h3>
          <button type="button" className={ws.iconBtn} onClick={onClose} aria-label="Close" style={{ marginLeft: "auto" }}>
            <X size={16} />
          </button>
        </div>
        <div />
        <div className={ws.drawerBody} style={{ display: "grid", gap: 18, alignContent: "start" }}>
          <div className={styles.section}>
            <h4>Details</h4>
            <div className={styles.formGrid}>
              <label className={ws.field} htmlFor="rs-name">
                <span>Name</span>
                <input id="rs-name" className={ws.input} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Radio Foorti" />
              </label>
              <label className={ws.field} htmlFor="rs-bn">
                <span>Bangla name</span>
                <input id="rs-bn" className={ws.input} value={form.name_bn} onChange={(e) => set("name_bn", e.target.value)} placeholder="রেডিও ফূর্তি" />
              </label>
              <label className={ws.field} htmlFor="rs-band">
                <span>Band</span>
                <select id="rs-band" className={ws.select} value={form.band} onChange={(e) => set("band", e.target.value)}>
                  <option value="FM">FM</option>
                  <option value="AM">AM</option>
                  <option value="Online">Online only</option>
                </select>
              </label>
              <label className={ws.field} htmlFor="rs-freq">
                <span>{form.band === "AM" ? "Frequency (kHz)" : "Frequency (MHz)"}</span>
                <input
                  id="rs-freq"
                  className={ws.input}
                  inputMode="decimal"
                  value={form.band === "Online" ? "" : form.frequency}
                  disabled={form.band === "Online"}
                  onChange={(e) => set("frequency", e.target.value)}
                  placeholder={form.band === "AM" ? "693" : "88.0"}
                />
              </label>
              <label className={ws.field} htmlFor="rs-city">
                <span>City (optional)</span>
                <input id="rs-city" className={ws.input} value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="Dhaka" />
              </label>
              <label className={ws.field} htmlFor="rs-logo">
                <span>Logo URL</span>
                <input id="rs-logo" className={ws.input} value={form.logo_url} onChange={(e) => set("logo_url", e.target.value)} placeholder="https://…/logo.png" />
              </label>
            </div>
            <label className={styles.check} htmlFor="rs-active">
              <input id="rs-active" type="checkbox" checked={form.is_active} onChange={(e) => set("is_active", e.target.checked)} />
              Show on the viewer site
            </label>
          </div>

          <div className={styles.section}>
            <h4>Stream links</h4>
            <p className={ws.muted}>The player tries these from top to bottom and switches to the next one when a link does not play.</p>
            {loading ? <p className={ws.muted}>Loading links…</p> : null}
            {links.map((link, i) => {
              const test = tests[link.key];
              const total = (link.success_count || 0) + (link.failure_count || 0);
              return (
                <div key={link.key} className={styles.linkRow}>
                  <span className={styles.order}>{i + 1}</span>
                  <div className={styles.linkFields}>
                    <input
                      type="url"
                      className={ws.input}
                      value={link.stream_url}
                      aria-label={`Link ${i + 1} URL`}
                      onChange={(e) => setLinks((list) => list.map((l) => (l.key === link.key ? { ...l, stream_url: e.target.value } : l)))}
                    />
                    <div className={styles.linkMeta}>
                      <input
                        type="text"
                        className={ws.input}
                        style={{ maxWidth: 180 }}
                        value={link.label}
                        placeholder="Label (optional)"
                        aria-label={`Link ${i + 1} label`}
                        onChange={(e) => setLinks((list) => list.map((l) => (l.key === link.key ? { ...l, label: e.target.value } : l)))}
                      />
                      <label className={styles.check}>
                        <input
                          type="checkbox"
                          checked={link.is_active}
                          onChange={(e) => setLinks((list) => list.map((l) => (l.key === link.key ? { ...l, is_active: e.target.checked } : l)))}
                        />
                        Active
                      </label>
                      <span>{total ? `${Math.round((link.success_count / total) * 100)}% played (${link.success_count}/${total})` : "No listener data yet"}</span>
                      {test?.running ? <span>Testing…</span> : null}
                      {test && !test.running ? <span className={test.ok ? styles.testOk : styles.testBad}>{test.note}</span> : null}
                    </div>
                  </div>
                  <div className={styles.linkBtns}>
                    <button type="button" className={ws.iconBtn} onClick={() => runTest(link)} aria-label={`Test link ${i + 1}`} title="Test">
                      <Play size={14} />
                    </button>
                    <button type="button" className={ws.iconBtn} onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move link ${i + 1} up`}>
                      <ArrowUp size={14} />
                    </button>
                    <button type="button" className={ws.iconBtn} onClick={() => move(i, 1)} disabled={i === links.length - 1} aria-label={`Move link ${i + 1} down`}>
                      <ArrowDown size={14} />
                    </button>
                    <button type="button" className={ws.iconBtn} onClick={() => setLinks((list) => list.filter((l) => l.key !== link.key))} aria-label={`Remove link ${i + 1}`}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
            <div className={ws.toolbar}>
              <input
                className={ws.input}
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addLink()}
                placeholder="https://… stream link (mp3, aac, m3u8)"
                aria-label="New stream link"
                style={{ flex: 1, minWidth: 0 }}
              />
              <button type="button" className={ws.ghostBtn} onClick={addLink}>
                <Plus size={14} />
                Add link
              </button>
            </div>
          </div>

          {error ? <p className={ws.errorText}>{error}</p> : null}
          <div className={ws.formActions}>
            <button type="button" className={ws.ghostBtn} onClick={onClose}>
              Cancel
            </button>
            <button type="button" className={ws.primaryBtn} onClick={save} disabled={saving || !form.name.trim()}>
              {saving ? "Saving…" : isNew ? "Add station" : "Save station"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RadioAdmin() {
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState(null); // station or {} for new
  const [deleting, setDeleting] = useState(null);
  const [query, setQuery] = useState("");
  const noticeTimer = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const json = await api("/api/admin/radio");
      setStations(json.stations || []);
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const flash = (msg) => {
    setNotice(msg);
    clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(""), 4000);
  };

  const toggleActive = async (s) => {
    try {
      await api(`/api/admin/radio/${s.id}`, { method: "PATCH", body: JSON.stringify({ is_active: !s.is_active }) });
      setStations((list) => list.map((x) => (x.id === s.id ? { ...x, is_active: !s.is_active } : x)));
    } catch (e) {
      setError(e.message);
    }
  };

  const move = async (index, d) => {
    const j = index + d;
    if (j < 0 || j >= stations.length) return;
    const next = [...stations];
    [next[index], next[j]] = [next[j], next[index]];
    setStations(next);
    try {
      await Promise.all([
        api(`/api/admin/radio/${next[index].id}`, { method: "PATCH", body: JSON.stringify({ position: index + 1 }) }),
        api(`/api/admin/radio/${next[j].id}`, { method: "PATCH", body: JSON.stringify({ position: j + 1 }) }),
      ]);
    } catch (e) {
      setError(e.message);
      load();
    }
  };

  const remove = async () => {
    const s = deleting;
    try {
      await api(`/api/admin/radio/${s.id}`, { method: "DELETE" });
      setDeleting(null);
      flash(`Deleted ${s.name}.`);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const q = query.trim().toLowerCase();
  const shown = stations.filter((s) => !q || `${s.name} ${s.name_bn} ${s.frequency ?? ""}`.toLowerCase().includes(q));
  const totalLinks = stations.reduce((n, s) => n + s.stats.active, 0);

  return (
    <section className={ws.page}>
      <div className={ws.pageHead}>
        <div>
          <h2>Radio</h2>
          <p className={ws.muted}>
            {stations.length} stations · {totalLinks} active links. Viewers open these from the Radio tab; each station switches to its next link when one stops.
          </p>
        </div>
        <div className={ws.headActions}>
          <input className={ws.input} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search stations" aria-label="Search stations" />
          <button type="button" className={ws.primaryBtn} onClick={() => setEditing({})}>
            <Plus size={16} />
            Add station
          </button>
        </div>
      </div>
      {notice ? <p className={ws.notice}>{notice}</p> : null}
      {error ? <p className={ws.errorText}>{error}</p> : null}
      {loading ? <p className={ws.muted}>Loading stations…</p> : null}
      {!loading && !error && !stations.length ? (
        <div className={ws.empty}>
          <p>No radio stations yet. Add the first one with its FM frequency and stream links.</p>
        </div>
      ) : null}

      {stations.length ? (
        <div className={styles.table}>
          <div className={`${styles.row} ${styles.head}`}>
            <span />
            <span>Station</span>
            <span>Frequency</span>
            <span>Links</span>
            <span>Listeners</span>
            <span />
          </div>
          {shown.map((s) => {
            const index = stations.indexOf(s);
            const total = s.stats.plays + s.stats.fails;
            return (
              <div key={s.id} className={`${styles.row} ${s.is_active ? "" : styles.inactive}`}>
                {s.logo_url ? <img src={s.logo_url} alt="" className={styles.logo} loading="lazy" /> : <span className={styles.logo}>{initials(s.name)}</span>}
                <div className={styles.name}>
                  <strong>{s.name}</strong>
                  <span>{[s.name_bn, s.city].filter(Boolean).join(" · ") || "—"}</span>
                </div>
                <span className={styles.freq}>{freqLabel(s)}</span>
                <span className={s.stats.active ? "" : ws.bad}>
                  {s.stats.active}/{s.stats.links} active
                </span>
                <span className={ws.muted}>{total ? `${Math.round((s.stats.plays / total) * 100)}% played` : "No data yet"}</span>
                <div className={styles.actions}>
                  <button type="button" className={ws.iconBtn} onClick={() => move(index, -1)} disabled={index === 0 || !!q} aria-label={`Move ${s.name} up`}>
                    <ArrowUp size={14} />
                  </button>
                  <button type="button" className={ws.iconBtn} onClick={() => move(index, 1)} disabled={index === stations.length - 1 || !!q} aria-label={`Move ${s.name} down`}>
                    <ArrowDown size={14} />
                  </button>
                  <button type="button" className={ws.ghostBtn} onClick={() => toggleActive(s)}>
                    {s.is_active ? "Hide" : "Show"}
                  </button>
                  <button type="button" className={ws.ghostBtn} onClick={() => setEditing(s)}>
                    <Pencil size={14} />
                    Edit
                  </button>
                  <button type="button" className={ws.iconBtn} onClick={() => setDeleting(s)} aria-label={`Delete ${s.name}`}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {editing ? (
        <StationDrawer
          station={editing.id ? editing : null}
          onClose={() => setEditing(null)}
          onSaved={(msg) => {
            setEditing(null);
            flash(msg);
            load();
          }}
        />
      ) : null}

      {deleting ? (
        <div className={ws.modalWrap} role="dialog" aria-modal="true" aria-labelledby="radio-delete-title">
          <div className={ws.modalCard}>
            <div className={ws.modalHead}>
              <h3 id="radio-delete-title">Delete {deleting.name}?</h3>
              <button type="button" className={ws.iconBtn} onClick={() => setDeleting(null)} aria-label="Close">
                <X size={16} />
              </button>
            </div>
            <p className={ws.muted}>The station and all {deleting.stats.links} of its links are removed. To keep it for later, use Hide instead.</p>
            <div className={ws.modalFoot}>
              <button type="button" className={ws.ghostBtn} onClick={() => setDeleting(null)}>
                Cancel
              </button>
              <button type="button" className={ws.dangerBtn} onClick={remove}>
                Delete station
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
