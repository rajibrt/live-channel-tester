"use client";

import { useState } from "react";
import styles from "../page.module.css";

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export default function CreatePlaylistForm() {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");

  return (
    <form method="post" action="/api/admin/playlists" className={styles.form}>
      <label className={styles.field}>
        <span>Playlist Name</span>
        <input
          name="name"
          value={name}
          onChange={(e) => {
            const nextName = e.target.value;
            setName(nextName);
            setSlug(slugify(nextName));
          }}
          placeholder="Playlist name"
          required
        />
      </label>
      <label className={styles.field}>
        <span>Playlist Slug (Auto)</span>
        <input
          name="slug"
          value={slug}
          onChange={(e) => setSlug(slugify(e.target.value))}
          placeholder="playlist-slug"
          required
        />
      </label>
      <button type="submit" className={styles.primaryBtn}>Save Playlist</button>
    </form>
  );
}
