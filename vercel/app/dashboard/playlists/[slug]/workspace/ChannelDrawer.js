"use client";

import { useEffect, useRef, useState } from "react";
import { Upload, X } from "lucide-react";
import styles from "../../workspace.module.css";
import { ChannelSourcesPanel } from "../ChannelSourcesDialog";
import { resolveBrowserPlaybackUrl } from "../../../../../lib/streamUrl";

const HLS_SRC = "https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js";

function loadHls() {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (window.Hls) return Promise.resolve(window.Hls);
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${HLS_SRC}"]`);
    const script = existing || document.createElement("script");
    script.addEventListener("load", () => resolve(window.Hls || null), { once: true });
    script.addEventListener("error", () => reject(new Error("Could not load the HLS player.")), { once: true });
    if (!existing) {
      script.src = HLS_SRC;
      script.async = true;
      document.head.appendChild(script);
    }
  });
}

// Plays one link in the drawer so admins can check it from their own network.
function StreamTester({ channelId, fallbackUrl }) {
  const videoRef = useRef(null);
  const [links, setLinks] = useState(fallbackUrl ? [{ stream_url: fallbackUrl, label: "primary" }] : []);
  const [index, setIndex] = useState(0);
  const [state, setState] = useState("idle");

  useEffect(() => {
    if (!channelId) return;
    let cancelled = false;
    fetch(`/api/admin/channels/${channelId}/sources`, { cache: "no-store" })
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled && Array.isArray(json?.sources) && json.sources.length) setLinks(json.sources);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [channelId]);

  const url = links[index]?.stream_url || "";

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !url) return undefined;
    let hls = null;
    let cancelled = false;
    setState("loading");
    const source = resolveBrowserPlaybackUrl(url, window.location.protocol);
    const onPlaying = () => !cancelled && setState("playing");
    const onError = () => !cancelled && setState("error");
    video.addEventListener("playing", onPlaying);
    video.addEventListener("error", onError);
    (async () => {
      try {
        if (/\.m3u8(\?|$)/i.test(source) && !video.canPlayType("application/vnd.apple.mpegurl")) {
          const Hls = await loadHls();
          if (cancelled) return;
          if (Hls?.isSupported?.()) {
            hls = new Hls();
            hls.on(Hls.Events.ERROR, (_e, data) => {
              if (data?.fatal && !cancelled) setState("error");
            });
            hls.loadSource(source);
            hls.attachMedia(video);
          } else {
            video.src = source;
          }
        } else {
          video.src = source;
        }
        video.muted = true;
        await video.play().catch(() => {});
      } catch {
        if (!cancelled) setState("error");
      }
    })();
    const timer = setTimeout(() => {
      if (!cancelled) setState((s) => (s === "loading" ? "timeout" : s));
    }, 12000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("error", onError);
      if (hls) hls.destroy();
      video.removeAttribute("src");
      video.load();
    };
  }, [url]);

  const stateText = {
    idle: "",
    loading: "Loading…",
    playing: "Playing from your network.",
    error: "This link did not play from your network.",
    timeout: "No picture after 12 seconds from your network.",
  }[state];

  return (
    <div className={styles.formGrid}>
      <label className={styles.field}>
        <span>Link to test</span>
        <select className={styles.select} value={index} onChange={(e) => setIndex(Number(e.target.value))}>
          {links.map((l, i) => (
            <option key={`${i}:${l.stream_url}`} value={i}>
              {i + 1}. {l.label ? `${l.label} — ` : ""}
              {l.stream_url.slice(0, 80)}
            </option>
          ))}
        </select>
      </label>
      <video ref={videoRef} className={styles.player} controls playsInline muted />
      {stateText ? <p className={state === "playing" ? styles.notice : state === "loading" ? styles.muted : styles.errorText}>{stateText}</p> : null}
      <p className={styles.muted}>
        The test runs in your browser, so it shows whether the link works on your ISP. Viewers on other ISPs may get a
        different result.
      </p>
    </div>
  );
}

function DetailsForm({ mode, channel, playlistSlug, groupNames, defaultGroup, onSaved, onCreated }) {
  const isNew = mode === "new";
  const [name, setName] = useState(channel?.name || "");
  const [category, setCategory] = useState(channel?.category ?? defaultGroup ?? "");
  const [logoUrl, setLogoUrl] = useState(channel?.logo_url || "");
  const [showOnHome, setShowOnHome] = useState(channel?.include_on_home !== false);
  const [streamUrl, setStreamUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const fileRef = useRef(null);

  const uploadLogo = async (file) => {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("playlist_slug", playlistSlug);
      const res = await fetch("/api/admin/media/logo-upload", { method: "POST", body: form });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.url) throw new Error(json?.error || "Logo upload failed.");
      setLogoUrl(json.url);
      setMessage("Logo uploaded. Save to apply it.");
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      if (isNew) {
        const res = await fetch("/api/admin/channels", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ playlist_slug: playlistSlug, name, stream_url: streamUrl, category, logo_url: logoUrl }),
        });
        const json = await res.json().catch(() => ({}));
        if (res.status === 409) {
          throw new Error(
            `This link already belongs to “${json?.item?.name || "another channel"}”. Add it as a backup link on that channel instead.`
          );
        }
        if (!res.ok || !json?.item?.id) throw new Error(json?.error || "Could not add the channel.");
        onCreated?.({ ...json.item, include_on_home: true, status: "LIVE" });
        return;
      }
      const res = await fetch(`/api/admin/channels/${channel.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, category, logo_url: logoUrl, include_on_home: showOnHome, playlist_slug: playlistSlug }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Could not save.");
      onSaved?.(json.channel);
      setMessage("Saved.");
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className={styles.formGrid} onSubmit={submit}>
      <label className={styles.field}>
        <span>Channel name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={200} />
      </label>
      {isNew ? (
        <label className={styles.field}>
          <span>Stream link</span>
          <input
            value={streamUrl}
            onChange={(e) => setStreamUrl(e.target.value)}
            placeholder="https://…/index.m3u8"
            required
            spellCheck={false}
          />
          <span className={styles.fieldHint}>You can add backup links after saving, in the Links tab.</span>
        </label>
      ) : null}
      <label className={styles.field}>
        <span>Group</span>
        <input value={category} onChange={(e) => setCategory(e.target.value)} list="workspace-group-names" placeholder="e.g. Bangla" />
        <datalist id="workspace-group-names">
          {groupNames.map((g) => (
            <option key={g} value={g} />
          ))}
        </datalist>
        <span className={styles.fieldHint}>Pick an existing group or type a new name.</span>
      </label>
      <div className={styles.field}>
        <span>Logo</span>
        <div className={styles.logoRow}>
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className={styles.logo} />
          ) : (
            <span className={`${styles.logo} ${styles.logoFallback}`}>{String(name || "TV").slice(0, 2).toUpperCase()}</span>
          )}
          <input className={styles.input} value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://…/logo.png" />
          <button type="button" className={styles.ghostBtn} onClick={() => fileRef.current?.click()} disabled={uploading}>
            <Upload size={14} />
            {uploading ? "Uploading…" : "Upload"}
          </button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => uploadLogo(e.target.files?.[0])} />
        </div>
      </div>
      {!isNew ? (
        <label className={styles.switch}>
          <input type="checkbox" checked={showOnHome} onChange={(e) => setShowOnHome(e.target.checked)} />
          Show this channel on the viewers' home page
        </label>
      ) : null}
      {message ? <p className={styles.notice}>{message}</p> : null}
      {error ? <p className={styles.errorText}>{error}</p> : null}
      <div className={styles.formActions}>
        <button type="submit" className={styles.primaryBtn} disabled={saving || uploading}>
          {saving ? "Saving…" : isNew ? "Add channel" : "Save details"}
        </button>
      </div>
    </form>
  );
}

export default function ChannelDrawer({
  mode,
  channel,
  playlistSlug,
  groupNames = [],
  defaultGroup = "",
  startTab,
  onClose,
  onChannelSaved,
  onCreated,
  onLinksSaved,
}) {
  const isNew = mode === "new";
  const [tab, setTab] = useState(isNew ? "details" : startTab || "details");
  const [linksBusy, setLinksBusy] = useState(false);

  useEffect(() => {
    setTab(isNew ? "details" : startTab || "details");
  }, [channel?.id, isNew, startTab]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && !linksBusy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, linksBusy]);

  if (!isNew && !channel) return null;
  const tabs = isNew
    ? [{ id: "details", label: "Details" }]
    : [
        { id: "details", label: "Details" },
        { id: "links", label: "Links" },
        { id: "test", label: "Test" },
      ];

  return (
    <div
      className={styles.drawerWrap}
      role="dialog"
      aria-modal="true"
      aria-labelledby="channel-drawer-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !linksBusy) onClose();
      }}
    >
      <div className={styles.drawer}>
        <div className={styles.drawerHead}>
          <h3 id="channel-drawer-title">{isNew ? "Add channel" : channel.name}</h3>
          <button type="button" className={styles.iconBtn} onClick={onClose} disabled={linksBusy} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <nav className={`${styles.tabs} ${styles.drawerTabs}`} role="tablist">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={`${styles.tab} ${tab === t.id ? styles.tabActive : ""}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <div className={styles.drawerBody}>
          {tab === "details" ? (
            <DetailsForm
              key={isNew ? "new" : channel.id}
              mode={mode}
              channel={channel}
              playlistSlug={playlistSlug}
              groupNames={groupNames}
              defaultGroup={defaultGroup}
              onSaved={onChannelSaved}
              onCreated={onCreated}
            />
          ) : null}
          {tab === "links" && !isNew ? (
            <ChannelSourcesPanel
              key={channel.id}
              channel={{ id: channel.id, name: channel.name }}
              onSaved={onLinksSaved}
              onPreview={() => setTab("test")}
              onBusyChange={setLinksBusy}
            />
          ) : null}
          {tab === "test" && !isNew ? <StreamTester key={channel.id} channelId={channel.id} fallbackUrl={channel.stream_url} /> : null}
        </div>
      </div>
    </div>
  );
}
