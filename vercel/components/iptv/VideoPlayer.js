"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "./icons";
import styles from "./iptv.module.css";
import { resolveBrowserPlaybackUrl } from "../../lib/streamUrl";

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
  favorites = [],
  onPrevChannel,
  onNextChannel,
  hasChannelNav,
  isTvMode,
  categories = [],
  channels = [],
  selectedCategory,
  onSelectCategory,
  onSelectChannel,
  onPlaybackAttempt,
  onPlaybackFailure,
}) {
  const videoRef = useRef(null);
  const shellRef = useRef(null);
  const hlsRef = useRef(null);
  const onPlaybackAttemptRef = useRef(onPlaybackAttempt);
  const onPlaybackFailureRef = useRef(onPlaybackFailure);
  const hlsNativeFallbackTriedRef = useRef(false);
  const hudTimerRef = useRef(null);
  const fsPanelsTimerRef = useRef(null);
  const autoFullscreenByOrientationRef = useRef(false);
  const fsInteractionActiveRef = useRef(false);
  const lastShellTapTsRef = useRef(0);
  const fsPanelsVisibleRef = useRef(false);
  const categoryListRef = useRef(null);
  const channelListRef = useRef(null);
  const allCategoriesBtnRef = useRef(null);
  const categoryBtnRefs = useRef({});
  const channelBtnRefs = useRef({});
  const lastVolumeBeforeMuteRef = useRef(100);
  const [status, setStatus] = useState("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [volumePercent, setVolumePercent] = useState(100);
  const [showVolumeHud, setShowVolumeHud] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showFsPanels, setShowFsPanels] = useState(false);
  const [fsCategorySearch, setFsCategorySearch] = useState("");
  const [fsChannelSearch, setFsChannelSearch] = useState("");
  const [videoFitMode, setVideoFitMode] = useState("contain");
  const [logoFailed, setLogoFailed] = useState(false);

  const isFullscreenActive = () => {
    if (typeof document === "undefined") return false;
    return (
      document.fullscreenElement === shellRef.current ||
      document.webkitFullscreenElement === shellRef.current ||
      document.fullscreenElement === videoRef.current ||
      document.webkitFullscreenElement === videoRef.current
    );
  };

  const requestFullscreenWithHiddenNav = async (element) => {
    if (!element?.requestFullscreen) return false;
    try {
      await element.requestFullscreen({ navigationUI: "hide" });
      return true;
    } catch {
      try {
        await element.requestFullscreen();
        return true;
      } catch {
        return false;
      }
    }
  };

  const requestPlayerFullscreen = async () => {
    const shell = shellRef.current;
    const video = videoRef.current;
    if (!shell || !video || typeof document === "undefined") return false;
    if (isFullscreenActive()) return true;
    try {
      if (shell.requestFullscreen) {
        const entered = await requestFullscreenWithHiddenNav(shell);
        if (!entered) return false;
        if (window?.screen?.orientation?.lock) {
          window.screen.orientation.lock("landscape").catch(() => {});
        }
        return true;
      }
      if (video.webkitEnterFullscreen) {
        video.webkitEnterFullscreen();
        return true;
      }
    } catch {
      // ignore fullscreen errors
    }
    return false;
  };

  const exitPlayerFullscreen = async () => {
    if (typeof document === "undefined") return false;
    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen();
        if (window?.screen?.orientation?.unlock) {
          window.screen.orientation.unlock();
        }
        return true;
      }
    } catch {
      // ignore fullscreen errors
    }
    return false;
  };

  const togglePlayerFullscreen = async () => {
    if (isFullscreenActive()) {
      await exitPlayerFullscreen();
      return;
    }
    await requestPlayerFullscreen();
  };

  const statusLabel = useMemo(() => {
    if (status === "loading") return "Switching channel...";
    if (status === "error") return errorMessage || "Stream unavailable";
    if (status === "playing") return "Live Stream Playing";
    return "Choose from the list to start streaming";
  }, [status, errorMessage]);

  useEffect(() => {
    onPlaybackAttemptRef.current = onPlaybackAttempt;
  }, [onPlaybackAttempt]);

  useEffect(() => {
    onPlaybackFailureRef.current = onPlaybackFailure;
  }, [onPlaybackFailure]);

  useEffect(() => {
    setLogoFailed(false);
  }, [channel?.logoUrl, channel?.id]);

  const logoFallbackText = useMemo(() => {
    const raw = String(channel?.logo || channel?.name || "TV").trim();
    if (!raw) return "TV";
    return raw.slice(0, 2).toUpperCase();
  }, [channel?.logo, channel?.name]);

  const showLogoImage = Boolean(channel?.logoUrl) && !logoFailed;

  const showHud = () => {
    setShowVolumeHud(true);
    if (hudTimerRef.current) clearTimeout(hudTimerRef.current);
    hudTimerRef.current = setTimeout(() => setShowVolumeHud(false), 1000);
  };

  const handleToggleMute = () => {
    const video = videoRef.current;
    if (!video) return;

    const currentPercent = Math.round((video.volume || 0) * 100);
    if (!video.muted && currentPercent > 0) {
      lastVolumeBeforeMuteRef.current = currentPercent;
      video.volume = 0;
      video.muted = true;
      setVolumePercent(0);
      showHud();
      return;
    }

    const restorePercent = Math.max(1, Math.min(100, Number(lastVolumeBeforeMuteRef.current) || 100));
    video.muted = false;
    video.volume = restorePercent / 100;
    setVolumePercent(restorePercent);
    showHud();
  };

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
      setErrorMessage("");
      return undefined;
    }

    let cancelled = false;
    let failureReported = false;
    setStatus("loading");
    setErrorMessage("");

    const reportAttempt = () => {
      onPlaybackAttemptRef.current?.({
        channel_id: String(channel?.id || ""),
        channel_name: String(channel?.name || ""),
        stream_url: String(channel?.streamUrl || ""),
      });
    };

    const reportFailure = (reason, details = {}) => {
      if (failureReported || cancelled) return;
      failureReported = true;
      onPlaybackFailureRef.current?.({
        channel_id: String(channel?.id || ""),
        channel_name: String(channel?.name || ""),
        stream_url: String(channel?.streamUrl || ""),
        reason: String(reason || "stream_unavailable"),
        ...details,
      });
    };

    let playbackStarted = false;
    const markPlaying = () => {
      if (cancelled) return;
      playbackStarted = true;
      setStatus("playing");
    };
    const markLoading = () => {
      // Avoid fullscreen loading backdrop flash during transient buffering.
      if (cancelled || playbackStarted) return;
      setStatus("loading");
    };
    const onError = () => {
      if (cancelled) return;
      setErrorMessage("Stream unavailable");
      setStatus("error");
      reportFailure("video_tag_error");
    };
    video.addEventListener("loadeddata", markPlaying);
    video.addEventListener("loadedmetadata", markPlaying);
    video.addEventListener("canplay", markPlaying);
    video.addEventListener("playing", markPlaying);
    video.addEventListener("waiting", markLoading);
    video.addEventListener("stalled", markLoading);
    video.addEventListener("error", onError);

    const source = resolveBrowserPlaybackUrl(
      channel.streamUrl,
      typeof window !== "undefined" ? window.location?.protocol : ""
    );
    const forceProxy = process.env.NEXT_PUBLIC_FORCE_STREAM_PROXY === "1";
    const sourceForPlayback = forceProxy ? resolveBrowserPlaybackUrl(source, "https:") : source;

    const startNativePlayback = () => {
      video.src = sourceForPlayback;
      video.play().catch(() => {
        // autoplay can be blocked
      });
    };

    reportAttempt();

    (async () => {
      try {
        // Some private-network .m3u8 sources work with native video tag faster/more reliably.
        // Prefer native path first to match dashboard quick-preview behavior.
        if (isPrivateSource && isHlsUrl(sourceForPlayback)) {
          startNativePlayback();
          return;
        }

        if (isHlsUrl(sourceForPlayback)) {
          const Hls = await loadHlsScript();
          if (cancelled) return;

          if (Hls?.isSupported?.()) {
            const hls = new Hls({ lowLatencyMode: true, maxBufferLength: 30 });
            hlsRef.current = hls;
            hls.loadSource(sourceForPlayback);
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
              setErrorMessage("Stream unavailable");
              setStatus("error");
              reportFailure("hls_fatal_error", {
                hls_type: String(data?.type || ""),
                hls_detail: String(data?.details || ""),
              });
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
        setErrorMessage("Stream unavailable");
        setStatus("error");
        reportFailure("playback_exception");
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
  }, [channel?.id, channel?.name, channel?.streamUrl]);

  useEffect(() => {
    const adjustVolume = (delta) => {
      const video = videoRef.current;
      if (!video) return;
      video.volume = Math.min(1, Math.max(0, (video.volume || 0) + delta));
      if (video.volume > 0 && video.muted) video.muted = false;
      setVolumePercent(Math.round(video.volume * 100));
      if (video.volume > 0) {
        lastVolumeBeforeMuteRef.current = Math.round(video.volume * 100);
      }
      showHud();
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
        togglePlayerFullscreen();
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

      if (key === "m" || key === "M" || code === "KeyM") {
        event.preventDefault();
        handleToggleMute();
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
    if (typeof window === "undefined") return undefined;

    const isMobileLayout = () => window.matchMedia("(max-width: 1023px)").matches;
    const isLandscape = () =>
      window.matchMedia("(orientation: landscape)").matches || window.innerWidth > window.innerHeight;

    const applyOrientationFullscreen = async () => {
      if (!isMobileLayout()) return;
      if (isLandscape()) {
        const entered = await requestPlayerFullscreen();
        if (entered) autoFullscreenByOrientationRef.current = true;
        return;
      }
      if (autoFullscreenByOrientationRef.current) {
        await exitPlayerFullscreen();
        autoFullscreenByOrientationRef.current = false;
      }
    };

    const onResize = () => {
      applyOrientationFullscreen();
    };

    const onFullscreenChange = () => {
      if (!isFullscreenActive()) autoFullscreenByOrientationRef.current = false;
    };

    window.addEventListener("resize", onResize, { passive: true });
    window.addEventListener("orientationchange", onResize);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    applyOrientationFullscreen();

    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => {
      const active =
        document.fullscreenElement === shellRef.current || document.fullscreenElement === videoRef.current;
      setIsFullscreen(active);
      if (active) showPanels({ keepVisible: false, focusSelected: true });
      else {
        setShowFsPanels(false);
        if (window?.screen?.orientation?.unlock) {
          window.screen.orientation.unlock();
        }
      }
    };

    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      if (fsPanelsTimerRef.current) clearTimeout(fsPanelsTimerRef.current);
    };
  }, []);

  useEffect(() => {
    fsPanelsVisibleRef.current = showFsPanels;
  }, [showFsPanels]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;

    const onVolumeChange = () => {
      const next = video.muted ? 0 : Math.round((video.volume || 0) * 100);
      setVolumePercent(next);
      if (!video.muted && next > 0) {
        lastVolumeBeforeMuteRef.current = next;
      }
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

  const handlePlayPause = async () => {
    const video = videoRef.current;
    if (!video || !hasStream) return;
    if (video.paused) {
      await handlePlay();
      return;
    }
    handlePause();
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
    if (safe > 0) {
      lastVolumeBeforeMuteRef.current = safe;
    }
    setVolumePercent(safe);
  };

  const cycleVideoFitMode = () => {
    setVideoFitMode((prev) => (prev === "cover" ? "contain" : "cover"));
  };

  const hasStream = Boolean(channel?.streamUrl);
  const isPlayingActive = hasStream && status === "playing" && !isPaused;
  const isPauseActive = hasStream && isPaused;
  const isStopActive = !hasStream || status === "idle" || status === "error";
  const isMuted = volumePercent === 0;

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

  const favoriteSet = useMemo(
    () => new Set((Array.isArray(favorites) ? favorites : []).map((id) => String(id || "").trim()).filter(Boolean)),
    [favorites]
  );

  const ensureSelectedVisible = (behavior = "smooth") => {
    requestAnimationFrame(() => {
      const categoryBtn = selectedCategory
        ? categoryBtnRefs.current[selectedCategory]
        : allCategoriesBtnRef.current;
      if (categoryBtn instanceof HTMLElement) {
        categoryBtn.scrollIntoView({ block: "start", inline: "nearest", behavior });
      }

      const channelBtn = channel?.id ? channelBtnRefs.current[channel.id] : null;
      if (channelBtn instanceof HTMLElement) {
        channelBtn.scrollIntoView({ block: "start", inline: "nearest", behavior });
      }
    });
  };

  const scheduleFsPanelsHide = (delay = 2400) => {
    if (!isFullscreenActive()) return;
    if (fsPanelsTimerRef.current) clearTimeout(fsPanelsTimerRef.current);
    fsPanelsTimerRef.current = setTimeout(() => {
      if (fsInteractionActiveRef.current) return;
      setShowFsPanels(false);
    }, delay);
  };

  const showPanels = ({ keepVisible = false, focusSelected = false } = {}) => {
    if (!isFullscreenActive()) return;
    const becameVisible = !fsPanelsVisibleRef.current;
    setShowFsPanels(true);
    if (focusSelected || becameVisible) ensureSelectedVisible("auto");
    if (keepVisible) {
      if (fsPanelsTimerRef.current) clearTimeout(fsPanelsTimerRef.current);
      return;
    }
    scheduleFsPanelsHide();
  };

  const togglePanelsByShellTap = () => {
    if (!isFullscreen) return;
    if (showFsPanels) {
      if (fsPanelsTimerRef.current) clearTimeout(fsPanelsTimerRef.current);
      setShowFsPanels(false);
      return;
    }
    showPanels({ keepVisible: false, focusSelected: true });
  };

  return (
    <div className={styles.videoSection}>
      <div
        ref={shellRef}
        className={styles.videoShell}
        onPointerMove={() => {
          if (!isFullscreen) return;
          showPanels({ keepVisible: fsInteractionActiveRef.current, focusSelected: !fsPanelsVisibleRef.current });
        }}
        onPointerDown={(event) => {
          fsInteractionActiveRef.current = true;
          if (!isFullscreen) return;
          if (event.pointerType !== "touch") {
            showPanels({ keepVisible: true, focusSelected: !fsPanelsVisibleRef.current });
          }
        }}
        onPointerUp={(event) => {
          fsInteractionActiveRef.current = false;
          if (isFullscreen && event.pointerType === "touch") {
            lastShellTapTsRef.current = Date.now();
            togglePanelsByShellTap();
            return;
          }
          scheduleFsPanelsHide(1200);
        }}
        onTouchStart={() => {
          fsInteractionActiveRef.current = true;
        }}
        onTouchEnd={() => {
          fsInteractionActiveRef.current = false;
          if (!isFullscreen) return;
          if (Date.now() - lastShellTapTsRef.current < 220) return;
          lastShellTapTsRef.current = Date.now();
          togglePanelsByShellTap();
        }}
        onDoubleClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          togglePlayerFullscreen();
        }}
        onClick={(event) => {
          if (event.detail > 1) return;
          if (Date.now() - lastShellTapTsRef.current < 350) return;
          togglePanelsByShellTap();
        }}
      >
        <video
          ref={videoRef}
          className={`${styles.videoElement} ${videoFitMode === "contain" ? styles.videoElementContain : ""}`}
          playsInline
        />

        {showVolumeHud ? <div className={styles.volumeHud}>Volume {volumePercent}%</div> : null}
        {isFullscreen && showFsPanels ? (
          <button
            type="button"
            className={styles.fsAspectBtn}
            onClick={(event) => {
              event.stopPropagation();
              cycleVideoFitMode();
              showPanels({ keepVisible: false, focusSelected: false });
            }}
          >
            <Icon name="MonitorPlay" size={14} />
            {videoFitMode === "cover" ? "Fit" : "Fill"}
          </button>
        ) : null}

        {isFullscreen && showFsPanels ? (
          <div
            className={styles.fullscreenOverlay}
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
            onPointerUp={(event) => event.stopPropagation()}
            onTouchStart={(event) => {
              event.stopPropagation();
              fsInteractionActiveRef.current = true;
              showPanels({ keepVisible: true });
            }}
            onTouchMove={(event) => {
              event.stopPropagation();
              fsInteractionActiveRef.current = true;
              showPanels({ keepVisible: true });
            }}
            onTouchEnd={(event) => {
              event.stopPropagation();
              fsInteractionActiveRef.current = false;
              scheduleFsPanelsHide(1600);
            }}
          >
            <aside
              className={`${styles.fullscreenPanel} ${isDark ? styles.darkGlass : styles.lightGlass}`}
              onPointerDown={() => {
                fsInteractionActiveRef.current = true;
                showPanels({ keepVisible: true });
              }}
              onPointerUp={() => {
                fsInteractionActiveRef.current = false;
                scheduleFsPanelsHide(1200);
              }}
              onTouchStart={() => {
                fsInteractionActiveRef.current = true;
                showPanels({ keepVisible: true });
              }}
              onTouchEnd={() => {
                fsInteractionActiveRef.current = false;
                scheduleFsPanelsHide(1200);
              }}
            >
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
              <div
                ref={categoryListRef}
                className={styles.fullscreenList}
                onScroll={() => showPanels({ keepVisible: true })}
              >
                <button
                  ref={allCategoriesBtnRef}
                  type="button"
                  className={`${styles.fullscreenListBtn} ${!selectedCategory ? styles.fullscreenListBtnActive : ""}`}
                  onClick={() => onSelectCategory?.(null)}
                >
                  All Channels
                </button>
                {filteredFsCategories.map((item) => (
                  <button
                    key={item.id}
                    ref={(el) => {
                      categoryBtnRefs.current[item.id] = el;
                    }}
                    type="button"
                    className={`${styles.fullscreenListBtn} ${selectedCategory === item.id ? styles.fullscreenListBtnActive : ""}`}
                    onClick={() => onSelectCategory?.(item.id)}
                  >
                    {item.name}
                  </button>
                ))}
              </div>
            </aside>

            <aside
              className={`${styles.fullscreenPanel} ${isDark ? styles.darkGlass : styles.lightGlass}`}
              onPointerDown={() => {
                fsInteractionActiveRef.current = true;
                showPanels({ keepVisible: true });
              }}
              onPointerUp={() => {
                fsInteractionActiveRef.current = false;
                scheduleFsPanelsHide(1200);
              }}
              onTouchStart={() => {
                fsInteractionActiveRef.current = true;
                showPanels({ keepVisible: true });
              }}
              onTouchEnd={() => {
                fsInteractionActiveRef.current = false;
                scheduleFsPanelsHide(1200);
              }}
            >
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
              <div
                ref={channelListRef}
                className={styles.fullscreenList}
                onScroll={() => showPanels({ keepVisible: true })}
              >
                {filteredFsChannels.map((item) => (
                  <button
                    key={item.id}
                    ref={(el) => {
                      channelBtnRefs.current[item.id] = el;
                    }}
                    type="button"
                    className={`${styles.fullscreenListBtn} ${channel?.id === item.id ? styles.fullscreenListBtnActive : ""}`}
                    onClick={() => onSelectChannel?.(item)}
                  >
                    <span className={styles.fullscreenChannelInfo}>
                      <span className={styles.fullscreenChannelLogo} aria-hidden="true">
                        <span className={styles.fullscreenChannelLogoFallback}>
                          {String(item?.logo || item?.name || "TV").slice(0, 2).toUpperCase()}
                        </span>
                        {item?.logoUrl ? (
                          <img
                            src={item.logoUrl}
                            alt=""
                            className={styles.fullscreenChannelLogoImg}
                            loading="lazy"
                            onError={(event) => {
                              event.currentTarget.style.display = "none";
                            }}
                          />
                        ) : null}
                      </span>
                      <span className={styles.fullscreenChannelName}>{item.name}</span>
                    </span>
                    <span className={styles.fullscreenChannelActions}>
                      <button
                        type="button"
                        className={`${styles.fullscreenFavoriteBtn} ${
                          favoriteSet.has(String(item?.id || "").trim()) ? styles.fullscreenFavoriteBtnActive : ""
                        }`}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          onToggleFavorite?.(item?.id);
                        }}
                        aria-label={
                          favoriteSet.has(String(item?.id || "").trim())
                            ? `Remove ${item?.name || "channel"} from favorites`
                            : `Add ${item?.name || "channel"} to favorites`
                        }
                        title={favoriteSet.has(String(item?.id || "").trim()) ? "Favorited" : "Add to Favorites"}
                      >
                        <Icon
                          name="Heart"
                          size={13}
                          fill={favoriteSet.has(String(item?.id || "").trim()) ? "currentColor" : "none"}
                        />
                      </button>
                    </span>
                  </button>
                ))}
              </div>
            </aside>

            <div
              className={`${styles.fsControlDock} ${isDark ? styles.darkGlass : styles.lightGlass}`}
              onPointerDown={() => {
                fsInteractionActiveRef.current = true;
                showPanels({ keepVisible: true });
              }}
              onPointerUp={() => {
                fsInteractionActiveRef.current = false;
                scheduleFsPanelsHide(1200);
              }}
              onTouchStart={() => {
                fsInteractionActiveRef.current = true;
                showPanels({ keepVisible: true });
              }}
              onTouchEnd={() => {
                fsInteractionActiveRef.current = false;
                scheduleFsPanelsHide(1200);
              }}
            >
              <div className={styles.fsControlCluster}>
                <button
                  type="button"
                  className={`${styles.fsControlBtn} ${(isPlayingActive || isPauseActive) ? styles.fsControlBtnActive : ""}`}
                  onClick={handlePlayPause}
                  disabled={!hasStream}
                  aria-label={isPaused ? "Play" : "Pause"}
                  title={isPaused ? "Play" : "Pause"}
                >
                  <Icon name={isPaused ? "Play" : "Pause"} size={18} />
                </button>
                <button
                  type="button"
                  className={`${styles.fsControlBtn} ${isStopActive ? styles.fsControlBtnActive : ""}`}
                  onClick={handleStop}
                  disabled={!hasStream}
                  aria-label="Stop"
                  title="Stop"
                >
                  <Icon name="Square" size={16} />
                </button>
                <button
                  type="button"
                  className={styles.fsControlBtn}
                  onClick={onPrevChannel}
                  disabled={!hasChannelNav}
                  aria-label="Previous channel"
                  title="Previous"
                >
                  <Icon name="ChevronLeft" size={18} />
                </button>
                <button
                  type="button"
                  className={styles.fsControlBtn}
                  onClick={onNextChannel}
                  disabled={!hasChannelNav}
                  aria-label="Next channel"
                  title="Next"
                >
                  <Icon name="ChevronRight" size={18} />
                </button>
              </div>
              <div className={styles.fsVolumeWrap}>
                <button
                  type="button"
                  className={`${styles.fsControlBtn} ${isMuted ? styles.fsControlBtnActive : ""}`}
                  onClick={handleToggleMute}
                  aria-label={isMuted ? "Unmute" : "Mute"}
                  title={isMuted ? "Unmute" : "Mute"}
                >
                  <Icon name={isMuted ? "VolumeX" : "Volume2"} size={18} />
                </button>
                <input
                  className={styles.fsVolumeSlider}
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={volumePercent}
                  onChange={handleVolumeInput}
                  aria-label="Volume"
                />
                <span className={styles.fsVolumeValue}>{volumePercent}%</span>
              </div>
            </div>
          </div>
        ) : null}

        {status !== "playing" ? (
          <div className={styles.videoBackdrop}>
            <div className={styles.videoBrand}>
              {showLogoImage ? (
                <img
                  src={channel.logoUrl}
                  alt=""
                  className={styles.videoBrandImg}
                  loading="lazy"
                  onError={() => setLogoFailed(true)}
                />
              ) : (
                <span className={styles.videoBrandFallback}>{logoFallbackText}</span>
              )}
            </div>
            <h2>{channel?.name || "Select a Channel"}</h2>
            <p>{statusLabel}</p>
            {status === "loading" ? <Icon name="LoaderCircle" className={styles.spinner} size={20} /> : null}
            {status === "error" ? <span className={styles.errorPill}>{errorMessage || "Stream unavailable"}</span> : null}
          </div>
        ) : null}
      </div>

      <div className={`${styles.playerControlsRow} ${isDark ? styles.darkGlass : styles.lightGlass}`}>
        <div className={styles.playerButtons}>
          <button
            type="button"
            className={`${styles.navBtn} ${(isPlayingActive || isPauseActive) ? styles.navBtnActive : styles.navBtnInactive}`}
            onClick={handlePlayPause}
            disabled={!hasStream}
            aria-pressed={isPlayingActive}
            aria-label={isPaused ? "Play" : "Pause"}
          >
            <Icon name={isPaused ? "Play" : "Pause"} size={16} />
            <span className={styles.controlLabel}>{isPaused ? "Play" : "Pause"}</span>
          </button>
          <button
            type="button"
            className={`${styles.navBtn} ${isStopActive ? styles.navBtnActive : styles.navBtnInactive}`}
            onClick={handleStop}
            disabled={!hasStream}
            aria-pressed={isStopActive}
            aria-label="Stop"
          >
            <Icon name="Square" size={14} />
            <span className={styles.controlLabel}>Stop</span>
          </button>
          <button
            type="button"
            className={`${styles.navBtn} ${isFullscreen ? styles.navBtnActive : styles.navBtnInactive}`}
            onClick={togglePlayerFullscreen}
            disabled={!hasStream}
            aria-pressed={isFullscreen}
            aria-label="Fullscreen"
          >
            <Icon name="Maximize2" size={14} />
            <span className={styles.controlLabel}>Fullscreen</span>
          </button>
          <div className={styles.desktopChannelNav}>
            <button type="button" className={styles.navBtn} onClick={onPrevChannel} disabled={!hasChannelNav} aria-label="Previous channel">
              <Icon name="ChevronLeft" size={16} />
              <span className={styles.controlLabel}>Prev</span>
            </button>
            <button type="button" className={styles.navBtn} onClick={onNextChannel} disabled={!hasChannelNav} aria-label="Next channel">
              <span className={styles.controlLabel}>Next</span>
              <Icon name="ChevronRight" size={16} />
            </button>
          </div>
        </div>
        <div className={styles.volumeControl}>
          <button
            type="button"
            className={`${styles.volumeMuteBtn} ${isMuted ? styles.volumeMuteBtnActive : styles.volumeMuteBtnInactive}`}
            onClick={handleToggleMute}
            aria-label={isMuted ? "Unmute" : "Mute"}
            title={isMuted ? "Unmute (M)" : "Mute (M)"}
            aria-pressed={isMuted}
          >
            <Icon name={isMuted ? "VolumeX" : "Volume2"} size={16} />
          </button>
          <input type="range" min="0" max="100" step="1" value={volumePercent} onChange={handleVolumeInput} />
          <span>{volumePercent}%</span>
        </div>
      </div>

      {channel ? (
        <article className={`${styles.channelInfo} ${isDark ? styles.darkGlass : styles.lightGlass}`}>
          <div className={styles.channelInfoLeft}>
            <div className={styles.channelInfoLogo} style={{ background: channel.gradientStyle }}>
              {showLogoImage ? (
                <img
                  src={channel.logoUrl}
                  alt=""
                  className={styles.channelInfoLogoImg}
                  loading="lazy"
                  onError={() => setLogoFailed(true)}
                />
              ) : (
                <span className={styles.channelInfoLogoFallback}>{logoFallbackText}</span>
              )}
            </div>
            <div className={styles.channelInfoText}>
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
            <button
              type="button"
              className={`${styles.favoriteBtn} ${isFavorite ? styles.favoriteBtnActive : styles.favoriteBtnInactive}`}
              onClick={() => onToggleFavorite(channel.id)}
              aria-pressed={isFavorite}
            >
              <Icon name="Heart" size={16} fill={isFavorite ? "currentColor" : "none"} />
              {isFavorite ? "Favorited" : "Add Favorite"}
            </button>
          </div>
        </article>
      ) : null}
    </div>
  );
}
