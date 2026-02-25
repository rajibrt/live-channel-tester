"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "../page.module.css";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../../components/ui/alert-dialog";
import { resolveBrowserPlaybackUrl } from "../../../lib/streamUrl";

const PLACEHOLDER_LOGO =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 64 64'><rect width='64' height='64' rx='10' fill='%23e2e8f0'/><circle cx='32' cy='24' r='9' fill='%2394a3b8'/><rect x='16' y='38' width='32' height='10' rx='5' fill='%2394a3b8'/></svg>";

function isHlsUrl(url) {
  return /\.m3u8(\?|$)/i.test(String(url || ""));
}

function loadHlsScript() {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (window.Hls) return Promise.resolve(window.Hls);

  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-hls-script="1"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(window.Hls || null), { once: true });
      existing.addEventListener("error", () => reject(new Error("Failed to load HLS script.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js";
    script.async = true;
    script.dataset.hlsScript = "1";
    script.onload = () => resolve(window.Hls || null);
    script.onerror = () => reject(new Error("Failed to load HLS script."));
    document.head.appendChild(script);
  });
}

function SearchableCombobox({
  value,
  options,
  placeholder,
  ariaLabel,
  onChange,
  onCommit,
  allowCreate = false,
  disabled = false,
}) {
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(String(value || ""));
  const [isFiltering, setIsFiltering] = useState(false);

  const normalize = (text) =>
    String(text || "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();

  useEffect(() => {
    setQuery(String(value || ""));
  }, [value]);

  useEffect(() => {
    function onDocMouseDown(event) {
      if (!rootRef.current) return;
      if (rootRef.current.contains(event.target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  const normalizedOptions = useMemo(() => {
    const out = [];
    const seen = new Set();
    for (const raw of options || []) {
      const name = String(raw || "").trim();
      if (!name || seen.has(name)) continue;
      seen.add(name);
      out.push(name);
    }
    return out;
  }, [options]);

  const filteredOptions = useMemo(() => {
    const q = normalize(query);
    if (!isFiltering || !q) return normalizedOptions;
    const scored = normalizedOptions
      .map((name, index) => {
        const candidate = normalize(name);
        if (!candidate.includes(q)) return null;
        let rank = 3;
        if (candidate === q) rank = 0;
        else if (candidate.startsWith(q)) rank = 1;
        else if (candidate.split(" ").some((part) => part.startsWith(q))) rank = 2;
        return { name, rank, index };
      })
      .filter(Boolean);
    if (!scored.length) return [];
    scored.sort((a, b) => a.rank - b.rank || a.index - b.index);
    return scored.map((row) => row.name);
  }, [normalizedOptions, query, isFiltering]);

  const hasExact = normalizedOptions.some((name) => normalize(name) === normalize(query));

  const commit = (rawValue) => {
    const next = String(rawValue || "").trim();
    if (!next && !allowCreate) return;
    const safe = next || "";
    setQuery(safe);
    setIsFiltering(false);
    onChange(safe);
    onCommit?.(safe);
    setOpen(false);
  };

  return (
    <div className={`${styles.menuWrap} ${styles.groupComboWrap}`} ref={rootRef}>
      <input
        className={styles.inlineInput}
        value={query}
        onFocus={() => {
          if (disabled) return;
          setOpen(true);
          setIsFiltering(false);
        }}
        onChange={(e) => {
          const next = e.target.value;
          setQuery(next);
          setIsFiltering(true);
          onChange(next);
          if (!disabled) setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit(query);
          }
          if (e.key === "Escape") {
            e.preventDefault();
            setOpen(false);
            setIsFiltering(false);
            setQuery(String(value || ""));
          }
        }}
        placeholder={placeholder}
        aria-label={ariaLabel}
        disabled={disabled}
      />
      {open && !disabled ? (
        <div className={`${styles.menuList} ${styles.groupComboMenu}`}>
          {filteredOptions.map((name) => (
            <button
              key={name}
              type="button"
              className={styles.menuItem}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => commit(name)}
            >
              {name}
            </button>
          ))}
          {allowCreate && query.trim() && !hasExact ? (
            <button
              type="button"
              className={styles.menuItem}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => commit(query)}
            >
              Use "{query.trim()}"
            </button>
          ) : null}
          {!filteredOptions.length && (!allowCreate || hasExact) ? (
            <div className={styles.menuItem}>No matching option</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default function ChannelAttachForm({
  playlists = [],
  categoriesByPlaylist = {},
  channelNamesByPlaylist = {},
}) {
  const playlistOptions = useMemo(
    () => playlists.map((row) => String(row?.slug || "").trim()).filter(Boolean),
    [playlists]
  );
  const [form, setForm] = useState({
    playlist_slug: playlistOptions[0] || "",
    name: "",
    stream_url: "",
    category: "",
    logo_url: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const prevPlaylistRef = useRef(String(playlistOptions[0] || "").trim().toLowerCase());
  const [previewVideoEl, setPreviewVideoEl] = useState(null);
  const previewHlsRef = useRef(null);

  const categoryOptions = useMemo(() => {
    const key = String(form.playlist_slug || "").trim().toLowerCase();
    return Array.isArray(categoriesByPlaylist?.[key]) ? categoriesByPlaylist[key] : [];
  }, [categoriesByPlaylist, form.playlist_slug]);
  const channelNameOptions = useMemo(() => {
    const key = String(form.playlist_slug || "").trim().toLowerCase();
    return Array.isArray(channelNamesByPlaylist?.[key]) ? channelNamesByPlaylist[key] : [];
  }, [channelNamesByPlaylist, form.playlist_slug]);

  useEffect(() => {
    const currentPlaylist = String(form.playlist_slug || "").trim().toLowerCase();
    if (currentPlaylist === prevPlaylistRef.current) return;
    prevPlaylistRef.current = currentPlaylist;
    setForm((prev) => ({
      ...prev,
      category: String(categoryOptions[0] || ""),
    }));
  }, [form.playlist_slug, categoryOptions]);

  useEffect(() => {
    if (!previewOpen) return undefined;

    const video = previewVideoEl;
    const rawSource = String(form.stream_url || "").trim();
    const source = resolveBrowserPlaybackUrl(
      rawSource,
      typeof window === "undefined" ? "" : window.location.protocol
    );
    if (!video) return undefined;

    if (previewHlsRef.current) {
      previewHlsRef.current.destroy();
      previewHlsRef.current = null;
    }
    video.pause();
    video.removeAttribute("src");
    video.load();

    if (!rawSource) {
      setPreviewError("Stream URL is empty.");
      setPreviewLoading(false);
      return undefined;
    }

    setPreviewError("");
    setPreviewLoading(true);
    let cancelled = false;
    let nativeFallbackTried = false;

    const onCanPlay = () => {
      if (cancelled) return;
      setPreviewLoading(false);
      setPreviewError("");
    };
    const onError = () => {
      if (cancelled) return;
      setPreviewLoading(false);
      setPreviewError("Unable to play this stream URL.");
    };
    video.addEventListener("loadedmetadata", onCanPlay);
    video.addEventListener("canplay", onCanPlay);
    video.addEventListener("playing", onCanPlay);
    video.addEventListener("error", onError);

    const startNativePlayback = () => {
      video.src = source;
      video.play().catch(() => {});
    };

    (async () => {
      try {
        if (isHlsUrl(source)) {
          const Hls = await loadHlsScript();
          if (cancelled) return;
          if (Hls?.isSupported?.()) {
            const hls = new Hls({ lowLatencyMode: true, maxBufferLength: 30 });
            previewHlsRef.current = hls;
            hls.loadSource(source);
            hls.attachMedia(video);
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
              if (cancelled) return;
              setPreviewLoading(false);
              video.play().catch(() => {});
            });
            hls.on(Hls.Events.ERROR, (_event, data) => {
              if (!data?.fatal || cancelled) return;
              hls.destroy();
              previewHlsRef.current = null;
              if (!nativeFallbackTried) {
                nativeFallbackTried = true;
                startNativePlayback();
                return;
              }
              setPreviewLoading(false);
              setPreviewError("Unable to play this stream URL.");
            });
            return;
          }
        }
        startNativePlayback();
      } catch {
        if (cancelled) return;
        setPreviewLoading(false);
        setPreviewError("Unable to load stream preview.");
      }
    })();

    return () => {
      cancelled = true;
      video.removeEventListener("loadedmetadata", onCanPlay);
      video.removeEventListener("canplay", onCanPlay);
      video.removeEventListener("playing", onCanPlay);
      video.removeEventListener("error", onError);
      if (previewHlsRef.current) {
        previewHlsRef.current.destroy();
        previewHlsRef.current = null;
      }
      video.pause();
      video.removeAttribute("src");
      video.load();
      setPreviewLoading(false);
    };
  }, [previewOpen, form.stream_url, previewVideoEl]);

  async function onSubmit(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!String(form.playlist_slug || "").trim()) {
      setError("Select a playlist.");
      return;
    }
    if (!String(form.name || "").trim() || !String(form.stream_url || "").trim()) {
      setError("Channel name and stream URL are required.");
      return;
    }

    setSaving(true);
    try {
      const data = new FormData();
      data.set("playlist_slug", String(form.playlist_slug || "").trim());
      data.set("name", String(form.name || "").trim());
      data.set("stream_url", String(form.stream_url || "").trim());
      data.set("category", String(form.category || "").trim());
      data.set("logo_url", String(form.logo_url || "").trim());

      const res = await fetch("/api/admin/channels", {
        method: "POST",
        body: data,
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Failed to save channel.");
      setMessage("Channel saved and attached to selected playlist/category.");
      setForm((prev) => ({
        ...prev,
        name: "",
        stream_url: "",
        logo_url: "",
      }));
    } catch (err) {
      setError(err?.message || "Failed to save channel.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className={styles.form}>
      <div className={styles.formGrid}>
        <label className={styles.field}>
          <span>Playlist <em className={styles.requiredMark}>*</em></span>
          <SearchableCombobox
            value={form.playlist_slug}
            options={playlistOptions}
            placeholder="Select playlist slug"
            ariaLabel="Playlist slug"
            onChange={(next) => setForm((prev) => ({ ...prev, playlist_slug: next }))}
            onCommit={(next) => setForm((prev) => ({ ...prev, playlist_slug: next }))}
          />
          <small className={styles.fieldHint}>Choose existing playlist to attach this channel.</small>
        </label>
        <label className={styles.field}>
          <span>Channel Name <em className={styles.requiredMark}>*</em></span>
          <SearchableCombobox
            value={form.name}
            options={channelNameOptions}
            placeholder="channel name"
            ariaLabel="Channel name"
            allowCreate
            onChange={(next) => setForm((prev) => ({ ...prev, name: next }))}
            onCommit={(next) => setForm((prev) => ({ ...prev, name: next }))}
            disabled={!String(form.playlist_slug || "").trim()}
          />
          <small className={styles.fieldHint}>Choose existing channel name from selected playlist or type new name.</small>
        </label>
      </div>

      <label className={styles.field}>
        <span>Stream URL <em className={styles.requiredMark}>*</em></span>
        <div className={styles.streamPreviewRow}>
          <input
            name="stream_url"
            value={form.stream_url}
            onChange={(e) => setForm((prev) => ({ ...prev, stream_url: e.target.value }))}
            placeholder="stream url"
            required
          />
          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={() => setPreviewOpen(true)}
            disabled={!String(form.stream_url || "").trim()}
          >
            Preview
          </button>
        </div>
      </label>

      <div className={styles.formGrid}>
        <label className={styles.field}>
          <span>Category (for selected playlist)</span>
          <SearchableCombobox
            value={form.category}
            options={categoryOptions}
            placeholder="Select or type category"
            ariaLabel="Category"
            allowCreate
            onChange={(next) => setForm((prev) => ({ ...prev, category: next }))}
            onCommit={(next) => setForm((prev) => ({ ...prev, category: next }))}
            disabled={!String(form.playlist_slug || "").trim()}
          />
          <small className={styles.fieldHint}>Combobox shows categories from selected playlist. You can type a new one.</small>
        </label>
        <label className={styles.field}>
          <span>Logo URL</span>
          <div className={styles.logoInputPreviewRow}>
            <input
              name="logo_url"
              value={form.logo_url}
              onChange={(e) => setForm((prev) => ({ ...prev, logo_url: e.target.value }))}
              placeholder="logo url"
            />
            <img
              src={String(form.logo_url || "").trim() || PLACEHOLDER_LOGO}
              alt="Channel logo preview"
              className={styles.channelLogoThumb}
              onError={(e) => {
                e.currentTarget.src = PLACEHOLDER_LOGO;
              }}
            />
          </div>
          <small className={styles.fieldHint}>Logo preview</small>
        </label>
      </div>

      {error ? <p className={styles.errorText}>{error}</p> : null}
      {message ? <p className={styles.successText}>{message}</p> : null}

      <button type="submit" className={styles.primaryBtn} disabled={saving}>
        {saving ? "Saving..." : "Save Channel"}
      </button>

      <AlertDialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <AlertDialogContent className={styles.viewerModal}>
          <AlertDialogHeader>
            <AlertDialogTitle>Stream Preview</AlertDialogTitle>
            <AlertDialogDescription>
              Preview from current Stream URL field.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {previewLoading ? <p className={styles.pending}>Loading preview...</p> : null}
          {previewError ? <p className={styles.errorText}>{previewError}</p> : null}

          <video ref={setPreviewVideoEl} controls autoPlay className={styles.video}>
            Your browser does not support video playback.
          </video>

          {String(form.stream_url || "").trim() ? (
            <p className={styles.pending}>
              Open direct link:{" "}
              <a href={String(form.stream_url || "").trim()} target="_blank" rel="noreferrer" className={styles.url}>
                {String(form.stream_url || "").trim()}
              </a>
            </p>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <button type="button" className={styles.secondaryBtn}>Close</button>
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );
}
