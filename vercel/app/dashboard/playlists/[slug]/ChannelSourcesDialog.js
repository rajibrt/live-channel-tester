"use client";

import { useEffect, useState } from "react";
import pageStyles from "../../page.module.css";
import styles from "./ChannelSourcesDialog.module.css";

// Manage a channel's ordered failover links. Viewers' players try the links
// top to bottom and switch automatically when one does not play.

function formatResult(source) {
  const ok = Number(source?.success_count || 0);
  const fail = Number(source?.failure_count || 0);
  if (!ok && !fail) return "No viewer data yet";
  const total = ok + fail;
  return `${Math.round((ok / total) * 100)}% played (${ok}/${total})`;
}

function toDraft(source) {
  return {
    key: `${source?.id ?? "new"}:${source?.stream_url || ""}:${Math.random().toString(36).slice(2, 7)}`,
    stream_url: String(source?.stream_url || ""),
    label: String(source?.label || ""),
    is_active: source?.is_active !== false,
    success_count: Number(source?.success_count || 0),
    failure_count: Number(source?.failure_count || 0),
  };
}

// Link manager body; used inside the classic-editor dialog and the workspace drawer.
export function ChannelSourcesPanel({ channel, onSaved, onPreview, onBusyChange }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [items, setItems] = useState([]);
  const [newUrl, setNewUrl] = useState("");
  const [newLabel, setNewLabel] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    fetch(`/api/admin/channels/${encodeURIComponent(channel.id)}/sources`, { cache: "no-store" })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || "Could not load links.");
        return json;
      })
      .then((json) => {
        if (cancelled) return;
        setItems((json.sources || []).map(toDraft));
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [channel.id]);

  useEffect(() => {
    onBusyChange?.(saving);
  }, [saving, onBusyChange]);

  const update = (index, patch) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
    setNotice("");
  };
  const move = (index, delta) => {
    setItems((prev) => {
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setNotice("");
  };
  const remove = (index) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
    setNotice("");
  };
  const addLink = () => {
    const url = newUrl.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) {
      setError("The link must start with http:// or https://.");
      return;
    }
    if (items.some((item) => item.stream_url.trim().toLowerCase() === url.toLowerCase())) {
      setError("This link is already in the list.");
      return;
    }
    setItems((prev) => [...prev, toDraft({ stream_url: url, label: newLabel.trim(), is_active: true })]);
    setNewUrl("");
    setNewLabel("");
    setError("");
    setNotice("");
  };

  const save = async () => {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch(`/api/admin/channels/${encodeURIComponent(channel.id)}/sources`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sources: items.map((item) => ({
            stream_url: item.stream_url.trim(),
            label: item.label.trim(),
            is_active: item.is_active,
          })),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Could not save.");
      setItems((json.sources || []).map(toDraft));
      const warnings = Array.isArray(json.warnings) ? json.warnings : [];
      setNotice(
        warnings.length
          ? `Saved. ${warnings.join(" ")}`
          : "Saved. Viewers get the new links within about a minute."
      );
      onSaved?.(json);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const activeCount = items.filter((item) => item.is_active).length;

  return (
    <div className={styles.panel}>
        <p className={styles.help}>
          The viewer's player tries these links from top to bottom and switches automatically when one does not play.
          Put the link that works on most ISPs first. Disabled links are not sent to viewers.
        </p>

        {loading ? <p className={styles.status}>Loading…</p> : null}

        {!loading && items.length ? (
          <ol className={styles.list}>
            {items.map((item, index) => (
              <li key={item.key} className={`${styles.row} ${item.is_active ? "" : styles.rowInactive}`}>
                <span className={styles.rank}>{index + 1}</span>
                <div className={styles.fields}>
                  <input
                    className={styles.urlInput}
                    value={item.stream_url}
                    onChange={(e) => update(index, { stream_url: e.target.value })}
                    aria-label={`Link ${index + 1}`}
                    spellCheck={false}
                  />
                  <div className={styles.meta}>
                    <input
                      className={styles.labelInput}
                      value={item.label}
                      onChange={(e) => update(index, { label: e.target.value })}
                      placeholder="Collection name (e.g. Collection A)"
                      aria-label={`Collection for link ${index + 1}`}
                    />
                    <span className={styles.result} title="Reported by viewers' players">
                      {formatResult(item)}
                    </span>
                  </div>
                </div>
                <div className={styles.actions}>
                  <button type="button" onClick={() => move(index, -1)} disabled={index === 0} aria-label="Move up">
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={index === items.length - 1}
                    aria-label="Move down"
                  >
                    ↓
                  </button>
                  <button type="button" onClick={() => onPreview?.(`${channel.name} — Link ${index + 1}`, item.stream_url)}>
                    Test
                  </button>
                  <label className={styles.toggle}>
                    <input
                      type="checkbox"
                      checked={item.is_active}
                      onChange={(e) => update(index, { is_active: e.target.checked })}
                    />
                    Active
                  </label>
                  <button
                    type="button"
                    className={styles.danger}
                    onClick={() => remove(index)}
                    disabled={items.length === 1}
                    aria-label="Remove link"
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ol>
        ) : null}

        {!loading ? (
          <div className={styles.addRow}>
            <input
              className={styles.urlInput}
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addLink();
              }}
              placeholder="New backup link (https://…m3u8)"
              spellCheck={false}
            />
            <input
              className={styles.labelInput}
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Collection"
            />
            <button type="button" onClick={addLink} disabled={!newUrl.trim()}>
              Add link
            </button>
          </div>
        ) : null}

        {error ? <p className={styles.error}>{error}</p> : null}
        {notice ? <p className={styles.notice}>{notice}</p> : null}

        <div className={styles.footer}>
          <span className={styles.status}>
            {items.length} links, {activeCount} active
          </span>
          <button
            type="button"
            className={styles.primary}
            onClick={save}
            disabled={saving || loading || !items.length || !activeCount}
          >
            {saving ? "Saving…" : "Save links"}
          </button>
        </div>
    </div>
  );
}

export default function ChannelSourcesDialog({ channel, onClose, onSaved, onPreview }) {
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, busy]);

  return (
    <div className={pageStyles.modalWrap} role="dialog" aria-modal="true" aria-labelledby="channel-sources-title">
      <div className={`${pageStyles.modalCard} ${styles.card}`}>
        <div className={pageStyles.modalHeader}>
          <h4 id="channel-sources-title">{channel.name || "Channel"} — Links</h4>
          <button type="button" className={pageStyles.closeBtn} onClick={onClose} disabled={busy}>
            Close
          </button>
        </div>
        <ChannelSourcesPanel channel={channel} onSaved={onSaved} onPreview={onPreview} onBusyChange={setBusy} />
      </div>
    </div>
  );
}
