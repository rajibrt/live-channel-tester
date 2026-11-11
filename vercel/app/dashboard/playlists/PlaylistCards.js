"use client";

import Link from "next/link";
import { useState } from "react";
import { Copy, ListVideo, Plus, X } from "lucide-react";
import styles from "./workspace.module.css";

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function formatDate(value) {
  const d = new Date(value || "");
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function CopyButton({ value }) {
  const [copied, setCopied] = useState(false);
  if (!value) return <span className={styles.muted}>No public link yet</span>;
  return (
    <button
      type="button"
      className={styles.ghostBtn}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          window.prompt("Copy the playlist link:", value);
        }
      }}
    >
      <Copy size={14} />
      {copied ? "Copied" : "Copy M3U link"}
    </button>
  );
}

function CreatePlaylistDialog({ onClose }) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  return (
    <div className={styles.modalWrap} role="dialog" aria-modal="true" aria-labelledby="create-playlist-title">
      <form method="post" action="/api/admin/playlists" className={styles.modalCard}>
        <div className={styles.modalHead}>
          <h3 id="create-playlist-title">New playlist</h3>
          <button type="button" className={styles.iconBtn} onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <label className={styles.field}>
          <span>Name</span>
          <input
            name="name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setSlug(slugify(e.target.value));
            }}
            placeholder="e.g. BDIX"
            required
            autoFocus
          />
        </label>
        <label className={styles.field}>
          <span>Slug (used in links)</span>
          <input name="slug" value={slug} onChange={(e) => setSlug(slugify(e.target.value))} placeholder="bdix" required />
        </label>
        <div className={styles.modalFoot}>
          <button type="button" className={styles.ghostBtn} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className={styles.primaryBtn}>
            Create playlist
          </button>
        </div>
      </form>
    </div>
  );
}

export default function PlaylistCards({ playlists = [] }) {
  const [creating, setCreating] = useState(false);
  return (
    <section className={styles.page}>
      <div className={styles.pageHead}>
        <div>
          <h2>Playlists</h2>
          <p className={styles.muted}>Open a playlist to manage its channels, groups, health and settings.</p>
        </div>
        <button type="button" className={styles.primaryBtn} onClick={() => setCreating(true)}>
          <Plus size={16} />
          New playlist
        </button>
      </div>

      {playlists.length ? (
        <div className={styles.cardGrid}>
          {playlists.map((p) => (
            <article key={p.slug} className={styles.playlistCard}>
              <div className={styles.playlistCardHead}>
                <span className={styles.playlistIcon} aria-hidden="true">
                  <ListVideo size={18} />
                </span>
                <div>
                  <h3>{p.name}</h3>
                  <p className={styles.muted}>/{p.slug}</p>
                </div>
              </div>
              <dl className={styles.statRow}>
                <div>
                  <dt>Channels</dt>
                  <dd>{p.total}</dd>
                </div>
                <div>
                  <dt>Live</dt>
                  <dd className={styles.good}>{p.live}</dd>
                </div>
                <div>
                  <dt>Dead</dt>
                  <dd className={p.dead ? styles.bad : ""}>{p.dead}</dd>
                </div>
                <div>
                  <dt>Groups</dt>
                  <dd>{p.groups}</dd>
                </div>
              </dl>
              <p className={styles.muted}>Updated {formatDate(p.updated_at)}</p>
              <div className={styles.cardActions}>
                <Link href={`/dashboard/playlists/${encodeURIComponent(p.slug)}`} className={styles.primaryBtn}>
                  Open
                </Link>
                <CopyButton value={p.playlistUrl} />
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className={styles.empty}>
          <p>No playlists yet.</p>
          <button type="button" className={styles.primaryBtn} onClick={() => setCreating(true)}>
            <Plus size={16} />
            Create the first playlist
          </button>
        </div>
      )}

      {creating ? <CreatePlaylistDialog onClose={() => setCreating(false)} /> : null}
    </section>
  );
}
