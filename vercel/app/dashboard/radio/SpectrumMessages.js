"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, MessageSquareText, Plus, Trash2 } from "lucide-react";
import ws from "../playlists/workspace.module.css";
import styles from "./radio-admin.module.css";

// Control panel for the text shown inside the radio spectrum.
export default function SpectrumMessages() {
  const [settings, setSettings] = useState(null);
  const [notices, setNotices] = useState([]);
  const [draft, setDraft] = useState("");
  const [pick, setPick] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    fetch("/api/admin/radio/messages")
      .then((r) => r.json().then((j) => (r.ok ? j : Promise.reject(new Error(j?.error || "Could not load messages.")))))
      .then((j) => {
        setSettings(j.settings);
        setNotices(j.notices || []);
      })
      .catch((e) => setError(e.message));
  }, []);

  const update = (fn) => {
    setSettings((s) => fn({ ...s, items: [...s.items], credit: { ...s.credit } }));
    setDirty(true);
    setNotice("");
  };
  const addText = (text, announcementId = "") => {
    const t = String(text || "").trim();
    if (!t) return;
    update((s) => ({ ...s, items: [...s.items, { id: Math.random().toString(36).slice(2, 10), text: t, enabled: true, announcementId }] }));
  };
  const move = (i, d) =>
    update((s) => {
      const j = i + d;
      if (j < 0 || j >= s.items.length) return s;
      [s.items[i], s.items[j]] = [s.items[j], s.items[i]];
      return s;
    });

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const r = await fetch("/api/admin/radio/messages", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ settings }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || "Could not save messages.");
      setSettings(j.settings);
      setDirty(false);
      setNotice("Saved. Listeners see the new messages within a minute.");
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (!settings) {
    return (
      <section className={styles.msgCard}>
        <h3>
          <MessageSquareText size={16} /> Spectrum messages
        </h3>
        {error ? <p className={ws.errorText}>{error}</p> : <p className={ws.muted}>Loading…</p>}
      </section>
    );
  }

  const shown = settings.items.filter((i) => i.enabled).length + (settings.credit.enabled ? 1 : 0);

  return (
    <section className={styles.msgCard}>
      <div className={styles.msgHead}>
        <div>
          <h3>
            <MessageSquareText size={16} /> Spectrum messages
          </h3>
          <p className={ws.muted}>
            Bold animated text inside the radio spectrum. Messages play in this order, then the credit line, then repeat.
          </p>
        </div>
        <label className={styles.check} htmlFor="msg-enabled">
          <input
            id="msg-enabled"
            type="checkbox"
            checked={settings.enabled}
            onChange={(e) => update((s) => ({ ...s, enabled: e.target.checked }))}
          />
          Show messages ({shown})
        </label>
      </div>

      <div className={styles.msgList}>
        {settings.items.map((it, i) => (
          <div key={it.id} className={styles.msgRow}>
            <input
              type="checkbox"
              checked={it.enabled}
              aria-label={`Show message ${i + 1}`}
              onChange={(e) => update((s) => ({ ...s, items: s.items.map((x) => (x.id === it.id ? { ...x, enabled: e.target.checked } : x)) }))}
            />
            <input
              className={ws.input}
              value={it.text}
              maxLength={220}
              aria-label={`Message ${i + 1}`}
              onChange={(e) => update((s) => ({ ...s, items: s.items.map((x) => (x.id === it.id ? { ...x, text: e.target.value } : x)) }))}
            />
            {it.announcementId ? <span className={styles.msgTag}>Notice</span> : null}
            <button type="button" className={ws.iconBtn} onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move message ${i + 1} up`}>
              <ArrowUp size={14} />
            </button>
            <button type="button" className={ws.iconBtn} onClick={() => move(i, 1)} disabled={i === settings.items.length - 1} aria-label={`Move message ${i + 1} down`}>
              <ArrowDown size={14} />
            </button>
            <button type="button" className={ws.iconBtn} onClick={() => update((s) => ({ ...s, items: s.items.filter((x) => x.id !== it.id) }))} aria-label={`Delete message ${i + 1}`}>
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        <div className={styles.msgRow}>
          <input
            type="checkbox"
            checked={settings.credit.enabled}
            aria-label="Show credit line"
            onChange={(e) => update((s) => ({ ...s, credit: { ...s.credit, enabled: e.target.checked } }))}
          />
          <input
            className={ws.input}
            value={settings.credit.text}
            maxLength={120}
            aria-label="Credit line"
            onChange={(e) => update((s) => ({ ...s, credit: { ...s.credit, text: e.target.value } }))}
          />
          <span className={styles.msgTag}>Credit</span>
        </div>
      </div>

      <div className={styles.msgAdd}>
        <input
          className={ws.input}
          value={draft}
          maxLength={220}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              addText(draft);
              setDraft("");
            }
          }}
          placeholder="Write a message, e.g. Eid Mubarak from WEBTVBD"
          aria-label="New message"
        />
        <button
          type="button"
          className={ws.ghostBtn}
          onClick={() => {
            addText(draft);
            setDraft("");
          }}
          disabled={!draft.trim()}
        >
          <Plus size={14} />
          Add message
        </button>
      </div>

      <div className={styles.msgAdd}>
        <select className={ws.select} value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Published notices">
          <option value="">{notices.length ? "Add a published notice…" : "No published notices"}</option>
          {notices.map((n) => (
            <option key={n.id} value={n.id}>
              {n.title}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={ws.ghostBtn}
          disabled={!pick}
          onClick={() => {
            const n = notices.find((x) => x.id === pick);
            if (n) addText(n.title, n.id);
            setPick("");
          }}
        >
          <Plus size={14} />
          Add notice
        </button>
        <label className={styles.check} htmlFor="msg-seconds">
          Each message
          <select
            id="msg-seconds"
            className={ws.select}
            value={settings.seconds}
            onChange={(e) => update((s) => ({ ...s, seconds: Number(e.target.value) }))}
          >
            {[5, 8, 12, 20, 30].map((n) => (
              <option key={n} value={n}>
                {n} s
              </option>
            ))}
          </select>
        </label>
      </div>

      {error ? <p className={ws.errorText}>{error}</p> : null}
      {notice ? <p className={ws.notice}>{notice}</p> : null}
      <div className={ws.formActions}>
        <button type="button" className={ws.primaryBtn} onClick={save} disabled={saving || !dirty}>
          {saving ? "Saving…" : "Save messages"}
        </button>
      </div>
    </section>
  );
}
