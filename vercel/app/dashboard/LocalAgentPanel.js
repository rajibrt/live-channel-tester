"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./page.module.css";

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function LocalAgentPanel({ defaultAgentBaseUrl }) {
  const [playlistUrl, setPlaylistUrl] = useState("");
  const [playlistFile, setPlaylistFile] = useState(null);
  const [agentBaseUrl, setAgentBaseUrl] = useState(defaultAgentBaseUrl || "http://127.0.0.1:8787");
  const [timeout, setTimeoutValue] = useState(10);
  const [delay, setDelay] = useState(0.2);
  const [maxItems, setMaxItems] = useState(0);
  const [verifySegment, setVerifySegment] = useState(true);
  const [loading, setLoading] = useState(false);
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [progress, setProgress] = useState({
    total: 0,
    currentIndex: 0,
    liveCount: 0,
    deadCount: 0,
    currentTitle: "",
    currentUrl: "",
  });
  const [liveItems, setLiveItems] = useState([]);
  const [checkedItems, setCheckedItems] = useState([]);
  const [preview, setPreview] = useState(null);
  const [playlistSlug, setPlaylistSlug] = useState("");
  const [playlistName, setPlaylistName] = useState("");
  const [mergeWithExisting, setMergeWithExisting] = useState(true);
  const [existingPlaylists, setExistingPlaylists] = useState([]);
  const [mergeTargetSlug, setMergeTargetSlug] = useState("");
  const [saveLoading, setSaveLoading] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saveDuplicateUrls, setSaveDuplicateUrls] = useState([]);

  const abortRef = useRef(null);
  const pausedRef = useRef(false);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    fetchExistingPlaylists();
  }, []);

  async function fetchExistingPlaylists() {
    try {
      const res = await fetch("/api/admin/playlists", { cache: "no-store" });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) return;
      setExistingPlaylists(Array.isArray(payload?.items) ? payload.items : []);
    } catch {
      // ignore silently
    }
  }

  async function onSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setPaused(false);
    setError("");
    setResult(null);
    setLiveItems([]);
    setCheckedItems([]);
    setSaveMessage("");
    setSaveError("");
    setSaveDuplicateUrls([]);
    setSaveLoading("");
    setProgress({
      total: 0,
      currentIndex: 0,
      liveCount: 0,
      deadCount: 0,
      currentTitle: "",
      currentUrl: "",
    });
    abortRef.current = new AbortController();
    try {
      if (!playlistUrl.trim() && !playlistFile) {
        throw new Error("Please provide Playlist URL or choose a .m3u file.");
      }

      const form = new FormData();
      if (playlistUrl.trim()) form.append("playlist_url", playlistUrl.trim());
      if (playlistFile) form.append("playlist_file", playlistFile, playlistFile.name || "upload.m3u");
      form.append("agent_base_url", agentBaseUrl.trim());
      form.append("timeout", String(timeout));
      form.append("delay", String(delay));
      form.append("max_items", String(maxItems));
      form.append("verify_segment", verifySegment ? "true" : "false");

      const res = await fetch("/api/admin/local-agent/check-stream", {
        method: "POST",
        body: form,
        signal: abortRef.current.signal,
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.error || "Failed to run local agent check.");
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No streaming response body received.");
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        while (pausedRef.current) {
          await wait(120);
        }
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          const raw = line.trim();
          if (!raw) continue;
          let evt = null;
          try {
            evt = JSON.parse(raw);
          } catch {
            continue;
          }
          if (evt?.type === "start") {
            setProgress((prev) => ({ ...prev, total: Number(evt.total || 0) }));
          }
          if (evt?.type === "current") {
            setProgress((prev) => ({
              ...prev,
              currentIndex: Number(evt.index || 0),
              total: Number(evt.total || prev.total || 0),
              currentTitle: String(evt.title || ""),
              currentUrl: String(evt.url || ""),
            }));
          }
          if (evt?.type === "item") {
            setProgress((prev) => ({
              ...prev,
              currentIndex: Number(evt.index || prev.currentIndex || 0),
              total: Number(evt.total || prev.total || 0),
              liveCount: Number(evt.live_count || prev.liveCount || 0),
              deadCount: Number(evt.dead_count || prev.deadCount || 0),
              currentTitle: String(evt.title || prev.currentTitle || ""),
              currentUrl: String(evt.url || prev.currentUrl || ""),
            }));
            if (String(evt.status || "").toUpperCase() === "LIVE" && evt.url) {
              setLiveItems((prev) => {
                if (prev.some((x) => x.url === evt.url)) return prev;
                return [
                  ...prev,
                  {
                    title: String(evt.title || "Stream"),
                    url: String(evt.url),
                    category: String(evt.category || ""),
                    logo_url: String(evt.logo_url || ""),
                    reason: String(evt.reason || ""),
                  },
                ];
              });
            }
            if (evt.url) {
              setCheckedItems((prev) => {
                const next = prev.filter((x) => x.url !== String(evt.url));
                next.push({
                  title: String(evt.title || "Stream"),
                  url: String(evt.url),
                  category: String(evt.category || ""),
                  logo_url: String(evt.logo_url || ""),
                  status: String(evt.status || "").toUpperCase() || "DEAD",
                });
                return next;
              });
            }
          }
          if (evt?.type === "complete") {
            setResult({
              total: Number(evt.total || 0),
              live_count: Number(evt.live_count || 0),
              dead_count: Number(evt.dead_count || 0),
              job_id: String(evt.job_id || ""),
              live_download_url: String(evt.download_url || ""),
              curated_download_url: String(evt.curated_download_url || ""),
            });
          }
        }
      }
    } catch (err) {
      if (err?.name === "AbortError") {
        setError("Check stopped.");
      } else {
        setError(err?.message || "Failed to run local agent check.");
      }
    } finally {
      setLoading(false);
      setPaused(false);
      abortRef.current = null;
    }
  }

  function stopRun() {
    if (abortRef.current) {
      abortRef.current.abort();
    }
  }

  async function saveChecked(mode) {
    try {
      setSaveError("");
      setSaveMessage("");
      setSaveDuplicateUrls([]);
      const slug = playlistSlug.trim().toLowerCase();
      if (!slug) {
        throw new Error("Playlist slug is required.");
      }
      const source = mode === "live"
        ? checkedItems.filter((x) => x.status === "LIVE")
        : checkedItems;
      if (!source.length) {
        throw new Error(mode === "live" ? "No LIVE links to save." : "No checked links to save.");
      }

      setSaveLoading(mode);
      const res = await fetch("/api/admin/local-agent/save-checked", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          playlist_slug: slug,
          playlist_name: playlistName.trim() || slug,
          merge_with_existing: mergeWithExisting,
          merge_playlist_slug: mergeWithExisting ? mergeTargetSlug : "",
          mode,
          items: source,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to save checked links.");
      }
      const dupes = Array.isArray(payload?.duplicate_urls) ? payload.duplicate_urls : [];
      setSaveDuplicateUrls(dupes);
      setSaveMessage(
        `Saved ${payload.saved_channels || 0} channel(s), attached ${payload.attached_channels || 0} to "${payload.playlist_slug}".`
      );
      await fetchExistingPlaylists();
    } catch (err) {
      setSaveError(err?.message || "Failed to save checked links.");
    } finally {
      setSaveLoading("");
    }
  }

  const canSave = checkedItems.length > 0;
  const disableSaveControls = loading || !!saveLoading;

  return (
    <form onSubmit={onSubmit} className={styles.form}>
      <label className={styles.field}>
        <span>Playlist URL</span>
        <input
          type="url"
          value={playlistUrl}
          onChange={(e) => setPlaylistUrl(e.target.value)}
          placeholder="https://example.com/playlist.m3u"
        />
      </label>

      <label className={styles.field}>
        <span>Choose .m3u file</span>
        <input
          type="file"
          accept=".m3u,.m3u8,audio/x-mpegurl,application/vnd.apple.mpegurl"
          onChange={(e) => setPlaylistFile(e.target.files?.[0] || null)}
        />
      </label>

      <p className={styles.hint}>Use URL or file upload. If both are set, uploaded file is used.</p>

      <div className={styles.inlineGrid}>
        <label className={styles.field}>
          <span>Local Agent Base URL</span>
          <input
            type="text"
            value={agentBaseUrl}
            onChange={(e) => setAgentBaseUrl(e.target.value)}
            placeholder="http://192.168.0.10:8787"
            required
          />
        </label>
        <label className={styles.field}>
          <span>Timeout (sec)</span>
          <input
            type="number"
            value={timeout}
            min="1"
            step="1"
            onChange={(e) => setTimeoutValue(Number(e.target.value || 10))}
          />
        </label>
      </div>

      <div className={styles.inlineGrid3}>
        <label className={styles.field}>
          <span>Delay (sec)</span>
          <input
            type="number"
            value={delay}
            min="0"
            step="0.1"
            onChange={(e) => setDelay(Number(e.target.value || 0))}
          />
        </label>
        <label className={styles.field}>
          <span>Max Items (0 = all)</span>
          <input
            type="number"
            value={maxItems}
            min="0"
            step="1"
            onChange={(e) => setMaxItems(Number(e.target.value || 0))}
          />
        </label>
        <label className={styles.checkRow}>
          <input
            type="checkbox"
            checked={verifySegment}
            onChange={(e) => setVerifySegment(e.target.checked)}
          />
          <span>Verify Segment</span>
        </label>
      </div>

      <div className={styles.controlRow}>
        <button type="submit" className={styles.primaryBtn} disabled={loading}>
          {loading ? "Running check..." : "Run Local IP Check"}
        </button>
        <button
          type="button"
          className={styles.secondaryBtn}
          disabled={!loading}
          onClick={() => setPaused((p) => !p)}
        >
          {paused ? "Resume" : "Pause"}
        </button>
        <button type="button" className={styles.secondaryBtn} disabled={!loading} onClick={stopRun}>
          Stop
        </button>
      </div>

      {error ? <p className={styles.errorText}>{error}</p> : null}

      <div className={styles.progressGrid}>
        <article className={styles.progressCard}>
          <p>Total Links</p>
          <strong>{progress.total}</strong>
        </article>
        <article className={styles.progressCard}>
          <p>Checking Now</p>
          <strong>{progress.currentIndex}{progress.total ? ` / ${progress.total}` : ""}</strong>
        </article>
        <article className={styles.progressCard}>
          <p>LIVE</p>
          <strong>{progress.liveCount}</strong>
        </article>
        <article className={styles.progressCard}>
          <p>Failed (DEAD)</p>
          <strong>{progress.deadCount}</strong>
        </article>
      </div>

      {progress.currentTitle || progress.currentUrl ? (
        <div className={styles.currentItem}>
          <p>
            <strong>Current:</strong> {progress.currentTitle || "Stream"}
          </p>
          <p className={styles.currentUrl}>{progress.currentUrl}</p>
        </div>
      ) : null}

      {result ? (
        <div className={styles.resultBox}>
          <p>
            Complete: <strong>{result.live_count}</strong> LIVE / <strong>{result.dead_count}</strong> DEAD
            {" "}from <strong>{result.total}</strong> entries.
          </p>
          <p>Job ID: <code>{result.job_id || "-"}</code></p>
          {result.live_download_url ? (
            <p>
              Live M3U:{" "}
              <a href={result.live_download_url} target="_blank" rel="noreferrer" className={styles.url}>
                {result.live_download_url}
              </a>
            </p>
          ) : null}
          {result.curated_download_url ? (
            <p>
              Curated M3U:{" "}
              <a href={result.curated_download_url} target="_blank" rel="noreferrer" className={styles.url}>
                {result.curated_download_url}
              </a>
            </p>
          ) : null}
        </div>
      ) : null}

      <div className={styles.saveBox}>
        <h3>Save Checked Result to Database</h3>
        <div className={styles.formGrid}>
          <label className={styles.field}>
            <span>Playlist Name</span>
            <input
              value={playlistName}
              onChange={(e) => {
                const nextName = e.target.value;
                setPlaylistName(nextName);
                setPlaylistSlug(slugify(nextName));
              }}
              placeholder="Playlist name"
              disabled={disableSaveControls}
            />
          </label>
          <label className={styles.field}>
            <span>Playlist Slug (Auto)</span>
            <input
              value={playlistSlug}
              onChange={(e) => setPlaylistSlug(slugify(e.target.value))}
              placeholder="playlist-slug"
              required
              disabled={disableSaveControls}
            />
          </label>
        </div>
        <div className={styles.mergeRow}>
          <label className={styles.checkRow}>
            <input
              type="checkbox"
              checked={mergeWithExisting}
              onChange={(e) => setMergeWithExisting(e.target.checked)}
              disabled={disableSaveControls}
            />
            <span>Merge with Existing Playlist</span>
          </label>
          <label className={styles.field}>
            <span>Existing Playlist</span>
            <select
              value={mergeTargetSlug}
              onChange={(e) => {
                const next = e.target.value;
                setMergeTargetSlug(next);
                const selected = existingPlaylists.find((x) => x.slug === next);
                if (selected) {
                  setPlaylistSlug(selected.slug || "");
                  setPlaylistName(selected.name || selected.slug || "");
                }
              }}
              disabled={disableSaveControls || !mergeWithExisting}
            >
              <option value="">Select playlist...</option>
              {existingPlaylists.map((p) => (
                <option key={p.slug} value={p.slug}>
                  {(p.name || p.slug)} ({p.slug})
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className={styles.saveActions}>
          <button
            type="button"
            className={styles.primaryBtn}
            onClick={() => saveChecked("live")}
            disabled={!!saveLoading || !canSave || loading}
          >
            {saveLoading === "live" ? "Saving LIVE..." : `Save LIVE only (${progress.liveCount})`}
          </button>
          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={() => saveChecked("all")}
            disabled={!!saveLoading || !canSave || loading}
          >
            {saveLoading === "all" ? "Saving all..." : `Save ALL checked (${checkedItems.length})`}
          </button>
        </div>
        {saveError ? <p className={styles.errorText}>{saveError}</p> : null}
        {saveMessage ? <p className={styles.successText}>{saveMessage}</p> : null}
        {saveDuplicateUrls.length ? (
          <p className={styles.hint}>
            Duplicate URLs skipped ({saveDuplicateUrls.length}): {saveDuplicateUrls.slice(0, 8).join(" | ")}
            {saveDuplicateUrls.length > 8 ? " ..." : ""}
          </p>
        ) : null}
      </div>

      {liveItems.length ? (
        <div className={styles.liveList}>
          <h3>LIVE Links ({liveItems.length})</h3>
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Stream URL</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {liveItems.map((item, idx) => (
                  <tr key={`${item.url}-${idx}`}>
                    <td>{item.title}</td>
                    <td>{item.category || "-"}</td>
                    <td>
                      <a href={item.url} target="_blank" rel="noreferrer" className={styles.url}>
                        {item.url}
                      </a>
                    </td>
                    <td>
                      <button
                        type="button"
                        className={styles.previewBtn}
                        onClick={() => setPreview({ title: item.title, url: item.url })}
                      >
                        Preview
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {preview ? (
        <div className={styles.modalWrap} role="dialog" aria-modal="true">
          <div className={styles.modalCard}>
            <div className={styles.modalHeader}>
              <h4>{preview.title || "Stream Preview"}</h4>
              <button type="button" className={styles.closeBtn} onClick={() => setPreview(null)}>
                Close
              </button>
            </div>
            <video controls autoPlay className={styles.video} src={preview.url}>
              Your browser could not play this stream.
            </video>
            <p className={styles.hint}>
              If preview does not play, open stream directly:{" "}
              <a href={preview.url} target="_blank" rel="noreferrer" className={styles.url}>
                {preview.url}
              </a>
            </p>
          </div>
        </div>
      ) : null}
    </form>
  );
}
