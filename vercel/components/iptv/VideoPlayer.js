"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "./icons";
import styles from "./iptv.module.css";

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

export default function VideoPlayer({
  channel,
  isDark,
  isFavorite,
  onToggleFavorite,
  onPrevChannel,
  onNextChannel,
  hasChannelNav,
  isTvMode,
  categories = [],
  channels = [],
  selectedCategory,
  onSelectCategory,
  onSelectChannel,
}) {
  const videoRef = useRef(null);
  const shellRef = useRef(null);
  const hlsRef = useRef(null);
  const hlsNativeFallbackTriedRef = useRef(false);
  const hudTimerRef = useRef(null);
  const fsPanelsTimerRef = useRef(null);
  const [status, setStatus] = useState("idle");
  const [volumePercent, setVolumePercent] = useState(100);
  const [showVolumeHud, setShowVolumeHud] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showFsPanels, setShowFsPanels] = useState(false);
  const [fsCategorySearch, setFsCategorySearch] = useState("");
  const [fsChannelSearch, setFsChannelSearch] = useState("");

  const statusLabel = useMemo(() => {
    if (status === "loading") return "Switching channel...";
    if (status === "error") return "Stream unavailable";
    if (status === "playing") return "Live Stream Playing";
    return "Choose from the list to start streaming";
  }, [status]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    video.pause();
    video.removeAttribute("src");
    video.load();
    hlsNativeFallbackTriedRef.current = false;

    if (!channel?.streamUrl) {
      setStatus("idle");
      return undefined;
    }

    let cancelled = false;
    setStatus("loading");

    const markPlaying = () => !cancelled && setStatus("playing");
    const markLoading = () => !cancelled && setStatus("loading");
    const onError = () => !cancelled && setStatus("error");
    video.addEventListener("loadeddata", markPlaying);
    video.addEventListener("loadedmetadata", markPlaying);
    video.addEventListener("canplay", markPlaying);
    video.addEventListener("playing", markPlaying);
    video.addEventListener("waiting", markLoading);
    video.addEventListener("stalled", markLoading);
    video.addEventListener("error", onError);

    const source = channel.streamUrl;
    const startNativePlayback = () => {
      video.src = source;
      video.play().catch(() => {
        // autoplay can be blocked
      });
    };

    (async () => {
      try {
        if (isHlsUrl(source)) {
          const Hls = await loadHlsScript();
          if (cancelled) return;

          if (Hls?.isSupported?.()) {
            const hls = new Hls({ lowLatencyMode: true, maxBufferLength: 30 });
            hlsRef.current = hls;
            hls.loadSource(source);
            hls.attachMedia(video);
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
              if (!cancelled) setStatus("playing");
              video.play().catch(() => {
                // autoplay can be blocked
              });
            });
            hls.on(Hls.Events.ERROR, (_event, data) => {
              if (!data?.fatal || cancelled) return;
              hls.destroy();
              hlsRef.current = null;
              if (!hlsNativeFallbackTriedRef.current) {
                hlsNativeFallbackTriedRef.current = true;
                startNativePlayback();
                return;
              }
              setStatus("error");
            });
            return;
          }
        }

        startNativePlayback();
      } catch {
        if (cancelled) return;
        if (!hlsNativeFallbackTriedRef.current) {
          hlsNativeFallbackTriedRef.current = true;
          startNativePlayback();
          return;
        }
        setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      video.removeEventListener("loadeddata", markPlaying);
      video.removeEventListener("loadedmetadata", markPlaying);
      video.removeEventListener("canplay", markPlaying);
      video.removeEventListener("playing", markPlaying);
      video.removeEventListener("waiting", markLoading);
      video.removeEventListener("stalled", markLoading);
      video.removeEventListener("error", onError);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [channel]);

  useEffect(() => {
    const showHud = () => {
      setShowVolumeHud(true);
      if (hudTimerRef.current) clearTimeout(hudTimerRef.current);
      hudTimerRef.current = setTimeout(() => setShowVolumeHud(false), 1000);
    };

    const adjustVolume = (delta) => {
      const video = videoRef.current;
      if (!video) return;
      video.volume = Math.min(1, Math.max(0, (video.volume || 0) + delta));
      if (video.volume > 0 && video.muted) video.muted = false;
      setVolumePercent(Math.round(video.volume * 100));
      showHud();
    };

    const toggleFullscreen = async () => {
      const shell = shellRef.current;
      if (!shell || typeof document === "undefined") return;
      try {
        if (document.fullscreenElement) {
          await document.exitFullscreen();
        } else {
          await shell.requestFullscreen();
        }
      } catch {
        // ignore fullscreen errors
      }
    };

    const onKeyDown = (event) => {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const key = String(event.key || "");
      const code = String(event.code || "");

      if (key === "f" || key === "F" || key === "F11" || code === "KeyF") {
        event.preventDefault();
        toggleFullscreen();
        return;
      }

      if (key === " " || key === "Spacebar" || code === "Space") {
        event.preventDefault();
        const video = videoRef.current;
        if (!video) return;
        if (video.paused) {
          video.play().catch(() => {});
        } else {
          video.pause();
        }
        return;
      }

      if (key === "ArrowLeft") {
        event.preventDefault();
        onPrevChannel?.();
        return;
      }

      if (key === "ArrowRight") {
        event.preventDefault();
        onNextChannel?.();
        return;
      }

      if (key === "ArrowUp") {
        event.preventDefault();
        if (isTvMode) onNextChannel?.();
        else adjustVolume(0.05);
        return;
      }

      if (key === "ArrowDown") {
        event.preventDefault();
        if (isTvMode) onPrevChannel?.();
        else adjustVolume(-0.05);
        return;
      }

      if (key === "PageUp" || key === "ChannelUp") {
        event.preventDefault();
        onNextChannel?.();
        return;
      }

      if (key === "PageDown" || key === "ChannelDown") {
        event.preventDefault();
        onPrevChannel?.();
        return;
      }

      if (key === "MediaPlayPause") {
        event.preventDefault();
        const video = videoRef.current;
        if (!video) return;
        if (video.paused) {
          video.play().catch(() => {});
        } else {
          video.pause();
        }
        return;
      }

      if (key === "MediaPlay") {
        event.preventDefault();
        videoRef.current?.play?.().catch(() => {});
        return;
      }

      if (key === "MediaPause") {
        event.preventDefault();
        videoRef.current?.pause?.();
        return;
      }

      if (key === "MediaStop") {
        event.preventDefault();
        const video = videoRef.current;
        if (!video) return;
        video.pause();
        try {
          video.currentTime = 0;
        } catch {
          // Some live streams do not support seeking
        }
        setStatus("idle");
        return;
      }

      if (
        key === "Escape" ||
        key === "Backspace" ||
        key === "BrowserBack" ||
        key === "GoBack"
      ) {
        if (document.fullscreenElement) {
          event.preventDefault();
          document.exitFullscreen().catch(() => {});
        }
      }
    };

    const onCustomNext = () => onNextChannel?.();
    const onCustomPrev = () => onPrevChannel?.();
    const onCustomPlayPause = () => {
      const video = videoRef.current;
      if (!video) return;
      if (video.paused) video.play().catch(() => {});
      else video.pause();
    };
    const onCustomPlay = () => videoRef.current?.play?.().catch(() => {});
    const onCustomPause = () => videoRef.current?.pause?.();
    const onCustomStop = () => {
      const video = videoRef.current;
      if (!video) return;
      video.pause();
      try {
        video.currentTime = 0;
      } catch {
        // Some live streams do not support seeking
      }
      setStatus("idle");
    };
    const onCustomBack = () => {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("tv-channel-next", onCustomNext);
    window.addEventListener("tv-channel-prev", onCustomPrev);
    window.addEventListener("tv-media-playpause", onCustomPlayPause);
    window.addEventListener("tv-media-play", onCustomPlay);
    window.addEventListener("tv-media-pause", onCustomPause);
    window.addEventListener("tv-media-stop", onCustomStop);
    window.addEventListener("tv-back", onCustomBack);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("tv-channel-next", onCustomNext);
      window.removeEventListener("tv-channel-prev", onCustomPrev);
      window.removeEventListener("tv-media-playpause", onCustomPlayPause);
      window.removeEventListener("tv-media-play", onCustomPlay);
      window.removeEventListener("tv-media-pause", onCustomPause);
      window.removeEventListener("tv-media-stop", onCustomStop);
      window.removeEventListener("tv-back", onCustomBack);
      if (hudTimerRef.current) clearTimeout(hudTimerRef.current);
    };
  }, [isTvMode, onNextChannel, onPrevChannel]);

  useEffect(() => {
    const showPanels = () => {
      if (document.fullscreenElement !== shellRef.current) return;
      setShowFsPanels(true);
      if (fsPanelsTimerRef.current) clearTimeout(fsPanelsTimerRef.current);
      fsPanelsTimerRef.current = setTimeout(() => setShowFsPanels(false), 2400);
    };

    const onMouseMove = () => showPanels();
    const onFullscreenChange = () => {
      const active = document.fullscreenElement === shellRef.current;
      setIsFullscreen(active);
      if (active) showPanels();
      else setShowFsPanels(false);
    };

    document.addEventListener("fullscreenchange", onFullscreenChange);
    const shell = shellRef.current;
    shell?.addEventListener("mousemove", onMouseMove);

    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      shell?.removeEventListener("mousemove", onMouseMove);
      if (fsPanelsTimerRef.current) clearTimeout(fsPanelsTimerRef.current);
    };
  }, [isFullscreen]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;

    const onVolumeChange = () => {
      const next = video.muted ? 0 : Math.round((video.volume || 0) * 100);
      setVolumePercent(next);
    };
    const onPlay = () => setIsPaused(false);
    const onPause = () => setIsPaused(true);

    video.addEventListener("volumechange", onVolumeChange);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);

    onVolumeChange();
    setIsPaused(video.paused);

    return () => {
      video.removeEventListener("volumechange", onVolumeChange);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
    };
  }, []);

  const handlePlay = async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      await video.play();
      setStatus("playing");
    } catch {
      setStatus("error");
    }
  };

  const handlePause = () => {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
  };

  const handleStop = () => {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    try {
      video.currentTime = 0;
    } catch {
      // Some live streams do not support seeking
    }
    setStatus("idle");
  };

  const handleVolumeInput = (event) => {
    const video = videoRef.current;
    if (!video) return;
    const next = Number(event.target.value);
    const safe = Number.isFinite(next) ? Math.max(0, Math.min(100, next)) : 100;
    video.volume = safe / 100;
    video.muted = safe === 0;
    setVolumePercent(safe);
  };

  const filteredFsCategories = useMemo(() => {
    const query = fsCategorySearch.trim().toLowerCase();
    if (!query) return categories;
    return categories.filter((item) => String(item?.name || "").toLowerCase().includes(query));
  }, [categories, fsCategorySearch]);

  const filteredFsChannels = useMemo(() => {
    const query = fsChannelSearch.trim().toLowerCase();
    if (!query) return channels;
    return channels.filter((item) => String(item?.name || "").toLowerCase().includes(query));
  }, [channels, fsChannelSearch]);

  return (
    <div className={styles.videoSection}>
      <div ref={shellRef} className={styles.videoShell}>
        <video ref={videoRef} className={styles.videoElement} playsInline />

        {showVolumeHud ? <div className={styles.volumeHud}>Volume {volumePercent}%</div> : null}

        {isFullscreen && showFsPanels ? (
          <div className={styles.fullscreenOverlay}>
            <aside className={`${styles.fullscreenPanel} ${isDark ? styles.darkGlass : styles.lightGlass}`}>
              <h4 className={styles.fullscreenPanelTitle}>Categories</h4>
              <div className={styles.fullscreenSearchWrap}>
                <Icon name="Search" size={13} className={styles.searchIcon} />
                <input
                  type="text"
                  value={fsCategorySearch}
                  onChange={(event) => setFsCategorySearch(event.target.value)}
                  placeholder="Search categories..."
                  className={styles.fullscreenSearchInput}
                />
              </div>
              <div className={styles.fullscreenList}>
                <button
                  type="button"
                  className={`${styles.fullscreenListBtn} ${!selectedCategory ? styles.fullscreenListBtnActive : ""}`}
                  onClick={() => onSelectCategory?.(null)}
                >
                  All Channels
                </button>
                {filteredFsCategories.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`${styles.fullscreenListBtn} ${selectedCategory === item.id ? styles.fullscreenListBtnActive : ""}`}
                    onClick={() => onSelectCategory?.(item.id)}
                  >
                    {item.name}
                  </button>
                ))}
              </div>
            </aside>

            <aside className={`${styles.fullscreenPanel} ${isDark ? styles.darkGlass : styles.lightGlass}`}>
              <h4 className={styles.fullscreenPanelTitle}>Channels</h4>
              <div className={styles.fullscreenSearchWrap}>
                <Icon name="Search" size={13} className={styles.searchIcon} />
                <input
                  type="text"
                  value={fsChannelSearch}
                  onChange={(event) => setFsChannelSearch(event.target.value)}
                  placeholder="Search channels..."
                  className={styles.fullscreenSearchInput}
                />
              </div>
              <div className={styles.fullscreenList}>
                {filteredFsChannels.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`${styles.fullscreenListBtn} ${channel?.id === item.id ? styles.fullscreenListBtnActive : ""}`}
                    onClick={() => onSelectChannel?.(item)}
                  >
                    <span className={styles.fullscreenChannelName}>{item.name}</span>
                  </button>
                ))}
              </div>
            </aside>
          </div>
        ) : null}

        {status !== "playing" ? (
          <div className={styles.videoBackdrop}>
            <div className={styles.videoBrand}>{channel?.logoUrl ? <img src={channel.logoUrl} alt={channel?.name || "Channel"} className={styles.videoBrandImg} /> : (channel?.logo || "TV")}</div>
            <h2>{channel?.name || "Select a Channel"}</h2>
            <p>{statusLabel}</p>
            {status === "loading" ? <Icon name="LoaderCircle" className={styles.spinner} size={20} /> : null}
            {status === "error" ? <span className={styles.errorPill}>Stream unavailable</span> : null}
          </div>
        ) : null}
      </div>

      <div className={`${styles.playerControlsRow} ${isDark ? styles.darkGlass : styles.lightGlass}`}>
        <div className={styles.playerButtons}>
          <button type="button" className={styles.navBtn} onClick={handlePlay} disabled={!channel?.streamUrl}>
            <Icon name="Play" size={16} />
            Play
          </button>
          <button type="button" className={styles.navBtn} onClick={handlePause} disabled={!channel?.streamUrl || isPaused}>
            <Icon name="Pause" size={16} />
            Pause
          </button>
          <button type="button" className={styles.navBtn} onClick={handleStop} disabled={!channel?.streamUrl}>
            <Icon name="Square" size={14} />
            Stop
          </button>
        </div>
        <label className={styles.volumeControl}>
          <Icon name="Volume2" size={16} />
          <input type="range" min="0" max="100" step="1" value={volumePercent} onChange={handleVolumeInput} />
          <span>{volumePercent}%</span>
        </label>
      </div>

      {channel ? (
        <article className={`${styles.channelInfo} ${isDark ? styles.darkGlass : styles.lightGlass}`}>
          <div className={styles.channelInfoLeft}>
            <div className={styles.channelInfoLogo} style={{ background: channel.gradientStyle }}>{channel.logoUrl ? <img src={channel.logoUrl} alt={channel.name} className={styles.channelInfoLogoImg} /> : channel.logo}</div>
            <div>
              <h3>{channel.name}</h3>
              <div className={styles.channelMetaRow}>
                <span className={styles.categoryPill}>{channel.category}</span>
                <span className={channel.isLive ? styles.metaLive : styles.metaOffline}>
                  {channel.isLive ? "Live" : "Offline"}
                </span>
              </div>
            </div>
          </div>
          <div className={styles.channelActions}>
            <button type="button" className={styles.navBtn} onClick={onPrevChannel} disabled={!hasChannelNav}>
              <Icon name="ChevronLeft" size={16} />
              Prev
            </button>
            <button type="button" className={styles.navBtn} onClick={onNextChannel} disabled={!hasChannelNav}>
              Next
              <Icon name="ChevronRight" size={16} />
            </button>
            <button type="button" className={styles.favoriteBtn} onClick={() => onToggleFavorite(channel.id)}>
              <Icon name="Heart" size={16} fill={isFavorite ? "currentColor" : "none"} />
              {isFavorite ? "Favorited" : "Add Favorite"}
            </button>
          </div>
        </article>
      ) : null}
    </div>
  );
}
