"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Copy, RefreshCw, Trash2 } from "lucide-react";
import styles from "../../workspace.module.css";

export default function SettingsTab({ playlist, playlistUrl }) {
  const router = useRouter();
  const [name, setName] = useState(playlist.name || "");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [confirmSlug, setConfirmSlug] = useState("");
  const [copied, setCopied] = useState(false);

  const rename = async (event) => {
    event.preventDefault();
    const nextName = name.trim();
    if (!nextName || nextName === playlist.name) return;
    setBusy("rename");
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/admin/playlists/rename", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ old_slug: playlist.slug, new_name: nextName }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Could not rename the playlist.");
      const nextSlug = String(json?.item?.slug || playlist.slug);
      router.replace(`/dashboard/playlists/${encodeURIComponent(nextSlug)}?tab=settings`);
      router.refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  };

  const rotateToken = async () => {
    if (
      playlistUrl &&
      !window.confirm("Create a new public link? The current M3U link will stop working for everyone who uses it.")
    ) {
      return;
    }
    setBusy("token");
    setError("");
    setMessage("");
    try {
      const form = new FormData();
      form.append("playlist_slug", playlist.slug);
      const res = await fetch("/api/admin/tokens", { method: "POST", body: form, redirect: "manual" });
      if (res.status >= 400) throw new Error("Could not create a new link.");
      setMessage("New public link created.");
      router.refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  };

  const deletePlaylist = async () => {
    setBusy("delete");
    setError("");
    try {
      const res = await fetch("/api/admin/playlists/delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug: playlist.slug }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Could not delete the playlist.");
      router.push("/dashboard/playlists");
      router.refresh();
    } catch (e) {
      setError(e.message);
      setBusy("");
    }
  };

  return (
    <div className={styles.settingsGrid}>
      <section className={styles.settingsCard}>
        <h3>Playlist name</h3>
        <form className={styles.formGrid} onSubmit={rename}>
          <label className={styles.field}>
            <span>Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} />
            <span className={styles.fieldHint}>The slug (/{playlist.slug}) is updated to match the new name.</span>
          </label>
          <div className={styles.formActions}>
            <button type="submit" className={styles.primaryBtn} disabled={busy !== "" || !name.trim() || name.trim() === playlist.name}>
              {busy === "rename" ? "Saving…" : "Save name"}
            </button>
          </div>
        </form>
      </section>

      <section className={styles.settingsCard}>
        <h3>Public M3U link</h3>
        <p className={styles.muted}>Apps and players can load this playlist from this link.</p>
        {playlistUrl ? (
          <div className={styles.linkBox}>
            <code>{playlistUrl}</code>
            <button
              type="button"
              className={styles.ghostBtn}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(playlistUrl);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                } catch {
                  window.prompt("Copy the playlist link:", playlistUrl);
                }
              }}
            >
              <Copy size={14} />
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        ) : (
          <p className={styles.muted}>No public link yet.</p>
        )}
        <div className={styles.formActions}>
          <button type="button" className={styles.ghostBtn} onClick={rotateToken} disabled={busy !== ""}>
            <RefreshCw size={14} />
            {busy === "token" ? "Working…" : playlistUrl ? "Create new link" : "Create public link"}
          </button>
        </div>
      </section>

      <section className={`${styles.settingsCard} ${styles.dangerZone}`}>
        <h3>Delete playlist</h3>
        <p className={styles.muted}>
          Removes the playlist, its public M3U link and its channel list and group order. The channel records themselves are kept. This
          cannot be undone.
        </p>
        <label className={styles.field}>
          <span>Type “{playlist.slug}” to confirm</span>
          <input value={confirmSlug} onChange={(e) => setConfirmSlug(e.target.value)} autoComplete="off" />
        </label>
        <div className={styles.formActions}>
          <button type="button" className={styles.dangerBtn} onClick={deletePlaylist} disabled={busy !== "" || confirmSlug !== playlist.slug}>
            <Trash2 size={14} />
            {busy === "delete" ? "Deleting…" : "Delete playlist"}
          </button>
        </div>
      </section>

      {message ? <p className={styles.notice}>{message}</p> : null}
      {error ? <p className={styles.errorText}>{error}</p> : null}
    </div>
  );
}
