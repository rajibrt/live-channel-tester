"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, ChevronLeft, Heart, Pause, Play, RotateCcw, Rewind, FastForward } from "lucide-react";
import styles from "./movies.module.css";
import { toStreamTranscodeUrl } from "../../lib/streamUrl";

function toSeconds(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n);
}

function formatClock(totalSeconds) {
  const safe = Math.max(0, toSeconds(totalSeconds));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function isTranscodePlaybackUrl(value) {
  const raw = String(value || "");
  return /stream-transcode/i.test(raw);
}

function hasLikelyUnsupportedAudioInUrl(value) {
  const raw = String(value || "").toLowerCase();
  if (!raw) return false;
  return /(ac-?3|eac-?3|dts|truehd|dd5\.1|ddp5\.1)/i.test(raw);
}

function isPrivateLanUrl(value) {
  try {
    const host = new URL(String(value || "")).hostname;
    if (!host) return false;
    if (host === "localhost" || host === "127.0.0.1") return true;
    if (/^10\.\d+\.\d+\.\d+$/.test(host)) return true;
    if (/^192\.168\.\d+\.\d+$/.test(host)) return true;
    if (/^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/.test(host)) return true;
    return false;
  } catch {
    return false;
  }
}

function shouldAvoidServerTranscode(rawUrl) {
  if (!isPrivateLanUrl(rawUrl)) return false;
  if (typeof window === "undefined") return false;
  const host = String(window.location.hostname || "").toLowerCase();
  // Hosted domain/server usually cannot reach user's private LAN source.
  return host !== "localhost" && host !== "127.0.0.1" && host !== "::1";
}

function resolveCompatibilityPlaybackUrl(rawSourceUrl) {
  const raw = String(rawSourceUrl || "").trim();
  if (!raw) return "";
  return toStreamTranscodeUrl(raw);
}

function isTruthyEnv(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return false;
  return !/^(0|false|no|off)$/i.test(raw);
}

function withTranscodeStart(value, seconds) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (!isTranscodePlaybackUrl(raw)) return raw;
  try {
    const u = new URL(raw, typeof window === "undefined" ? "http://localhost" : window.location.origin);
    u.searchParams.set("start", String(Math.max(0, toSeconds(seconds))));
    if (u.origin === "http://localhost" && raw.startsWith("/")) {
      return `${u.pathname}${u.search}`;
    }
    return u.toString();
  } catch {
    const sep = raw.includes("?") ? "&" : "?";
    return `${raw}${sep}start=${encodeURIComponent(String(Math.max(0, toSeconds(seconds))))}`;
  }
}

async function diagnoseTranscodeFailure(playbackUrl) {
  const url = String(playbackUrl || "").trim();
  if (!isTranscodePlaybackUrl(url)) return "";
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      method: "GET",
      credentials: "include",
      headers: { Range: "bytes=0-" },
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (res.ok) return "";
    const body = await res.json().catch(() => ({}));
    const reason = String(body?.reason || body?.error || "").trim();
    const details = String(body?.details || "").trim();
    return [reason, details].filter(Boolean).join(" | ").slice(0, 220);
  } catch {
    return "";
  }
}

export default function MoviePlayer({
  movie,
  startFrom = null,
  replayToken = 0,
  onRestart,
  onMarkComplete,
  onToggleFavorite,
  onBackToList,
  onProgressSaved,
  onMarkedComplete,
  onTrackActivity,
}) {
  const videoRef = useRef(null);
  const intervalRef = useRef(null);
  const onProgressSavedRef = useRef(onProgressSaved);
  const onMarkedCompleteRef = useRef(onMarkedComplete);
  const onTrackActivityRef = useRef(onTrackActivity);
  const transcodeOffsetRef = useRef(0);
  const seekStartFromRef = useRef(null);
  const [statusText, setStatusText] = useState("Ready");
  const [isPaused, setIsPaused] = useState(false);
  const [seekNonce, setSeekNonce] = useState(0);
  const [playbackSeconds, setPlaybackSeconds] = useState(0);
  const [fallbackPlaybackUrl, setFallbackPlaybackUrl] = useState("");
  const [compatModeRequested, setCompatModeRequested] = useState(false);
  const [compatibilityDisabled, setCompatibilityDisabled] = useState(false);
  const [scrubValue, setScrubValue] = useState(null);
  const fallbackTriedRef = useRef(false);
  const autoCompatAttemptedRef = useRef(false);
  const forceCompatMode = isTruthyEnv(process.env.NEXT_PUBLIC_STREAM_ALWAYS_COMPAT_MODE);

  useEffect(() => {
    onProgressSavedRef.current = onProgressSaved;
  }, [onProgressSaved]);

  useEffect(() => {
    onMarkedCompleteRef.current = onMarkedComplete;
  }, [onMarkedComplete]);

  useEffect(() => {
    onTrackActivityRef.current = onTrackActivity;
  }, [onTrackActivity]);

  useEffect(() => {
    fallbackTriedRef.current = false;
    autoCompatAttemptedRef.current = false;
    setFallbackPlaybackUrl("");
    setCompatModeRequested(false);
    setCompatibilityDisabled(false);
    seekStartFromRef.current = null;
    setSeekNonce(0);
    setScrubValue(null);
  }, [movie?.id]);

  useEffect(() => {
    const rawUrl = String(movie?.source?.rawUrl || "").trim();
    if (!rawUrl) return undefined;
    if (fallbackPlaybackUrl) return undefined;
    if (compatibilityDisabled) return undefined;

    const compatibilityUrl = resolveCompatibilityPlaybackUrl(rawUrl);
    if (forceCompatMode) {
      if (compatibilityUrl) {
        fallbackTriedRef.current = true;
        setCompatModeRequested(true);
        setStatusText("Compatibility mode forced by environment.");
        setFallbackPlaybackUrl(compatibilityUrl);
      }
      return undefined;
    }

    // For common unsupported audio labels in filenames (DD5.1/DTS/EAC3),
    // attempt compatibility mode once per movie automatically.
    if (!autoCompatAttemptedRef.current && hasLikelyUnsupportedAudioInUrl(rawUrl) && compatibilityUrl) {
      autoCompatAttemptedRef.current = true;
      fallbackTriedRef.current = true;
      setCompatModeRequested(true);
      setStatusText("Likely unsupported audio codec detected. Switching to compatibility mode...");
      setFallbackPlaybackUrl(compatibilityUrl);
      return undefined;
    }

    let cancelled = false;
    const controller = new AbortController();

    const runProbe = async () => {
      try {
        const compatibilityUrl = resolveCompatibilityPlaybackUrl(rawUrl);
        const probeRes = await fetch(`/api/stream-probe?url=${encodeURIComponent(rawUrl)}`, {
          method: "GET",
          credentials: "include",
          signal: controller.signal,
          cache: "no-store",
        });
        if (!probeRes.ok) return;
        const probe = await probeRes.json().catch(() => ({}));
        if (cancelled) return;
        if (probe?.should_transcode_audio && compatibilityUrl) {
          fallbackTriedRef.current = true;
          setStatusText("Compatibility audio detected. Preparing playback...");
          setCompatModeRequested(true);
          setFallbackPlaybackUrl(compatibilityUrl);
        }
      } catch {
        // ignore probe failures and keep native playback
      }
    };

    runProbe();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [compatModeRequested, compatibilityDisabled, fallbackPlaybackUrl, forceCompatMode, movie?.id, movie?.source?.rawUrl]);

  const postProgress = useCallback(
    async (source) => {
      const id = String(movie?.id || "");
      if (!id) return;
      const video = videoRef.current;
      if (!video) return;

      const payload = {
        position_seconds: toSeconds(video.currentTime) + toSeconds(transcodeOffsetRef.current),
        duration_seconds: Number.isFinite(Number(video.duration))
          ? toSeconds(video.duration) + toSeconds(transcodeOffsetRef.current)
          : toSeconds(movie?.runtimeSeconds || movie?.progress?.durationSeconds || 0),
        source,
      };

      try {
        const res = await fetch(`/api/client/movies/${encodeURIComponent(id)}/progress`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
          credentials: "include",
          keepalive: source === "pagehide" || source === "pause" || source === "seek",
        });
        if (!res.ok) {
          console.warn(`movie progress save failed: HTTP ${res.status}`);
          return;
        }
        const data = await res.json().catch(() => ({}));
        onProgressSavedRef.current?.(id, {
          positionSeconds: Number(data?.position_seconds || 0),
          durationSeconds: Number(data?.duration_seconds || 0),
          progressPercent: Number(data?.progress_percent || 0),
          isCompleted: Boolean(data?.is_completed),
          updatedAt: new Date().toISOString(),
        });
      } catch {
        // ignore save progress failures
      }
    },
    [movie?.id, movie?.runtimeSeconds, movie?.progress?.durationSeconds]
  );

  const postComplete = useCallback(async () => {
    const id = String(movie?.id || "");
    if (!id) return;
    try {
      const res = await fetch(`/api/client/movies/${encodeURIComponent(id)}/complete`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
      });
      if (!res.ok) return;
      onMarkedCompleteRef.current?.(id);
      onTrackActivityRef.current?.("movie_complete", { movie_id: id });
    } catch {
      // ignore completion failures
    }
  }, [movie?.id]);

  const queueTranscodeSeek = useCallback((seconds) => {
    seekStartFromRef.current = Math.max(0, toSeconds(seconds));
    setSeekNonce((prev) => prev + 1);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;

    video.pause();
    video.removeAttribute("src");
    video.load();

    const playbackUrl = String(fallbackPlaybackUrl || movie?.playbackUrl || "");
    if (!playbackUrl) {
      setStatusText("Select a movie with a playable source.");
      return undefined;
    }

    setStatusText("Loading...");
    const isTranscoded = isTranscodePlaybackUrl(playbackUrl);
    const fallbackStart = toSeconds(movie?.progress?.positionSeconds);
    const requestedSeek = seekStartFromRef.current;
    const requestedStart =
      requestedSeek === null ? (startFrom === null ? fallbackStart : toSeconds(startFrom)) : toSeconds(requestedSeek);
    const desiredStart = Math.max(0, requestedStart);
    transcodeOffsetRef.current = isTranscoded ? desiredStart : 0;
    video.src = isTranscoded ? withTranscodeStart(playbackUrl, desiredStart) : playbackUrl;
    video.load();

    const handleLoadedMetadata = () => {
      if (!isTranscoded && desiredStart > 0 && Number.isFinite(video.duration)) {
        video.currentTime = Math.min(desiredStart, Math.max(0, Math.floor(video.duration) - 1));
      }
      setPlaybackSeconds(transcodeOffsetRef.current);
      setStatusText("Playing");
      onTrackActivityRef.current?.("movie_playback_attempt", {
        movie_id: String(movie?.id || ""),
        source_label: String(movie?.source?.label || ""),
      });
      postProgress("start");
      video.play().catch(() => {});
      seekStartFromRef.current = null;
    };

    const handlePause = () => {
      setStatusText("Paused");
      setIsPaused(true);
      postProgress("pause");
    };

    const handleSeeked = () => {
      postProgress("seek");
      setPlaybackSeconds(toSeconds(video.currentTime) + toSeconds(transcodeOffsetRef.current));
    };

    const handlePlay = () => {
      setStatusText("Playing");
      setIsPaused(false);
    };

    const handleTimeUpdate = () => {
      setPlaybackSeconds(toSeconds(video.currentTime) + toSeconds(transcodeOffsetRef.current));
    };

    const handleEnded = () => {
      setStatusText("Completed");
      postComplete();
    };

    const handleError = () => {
      const rawUrl = String(movie?.source?.rawUrl || "");
      const compatibilityUrl = resolveCompatibilityPlaybackUrl(rawUrl);
      const canFallback =
        !fallbackTriedRef.current &&
        !isTranscoded &&
        rawUrl &&
        compatibilityUrl;
      if (canFallback) {
        fallbackTriedRef.current = true;
        const currentAbs = toSeconds(video.currentTime) + toSeconds(transcodeOffsetRef.current);
        setStatusText("Switching to compatibility audio...");
        seekStartFromRef.current = currentAbs;
        setCompatModeRequested(true);
        setFallbackPlaybackUrl(compatibilityUrl);
        return;
      }
      if (!isTranscoded && shouldAvoidServerTranscode(rawUrl) && !compatModeRequested) {
        setStatusText("Playback failed (server cannot access private source; using direct LAN playback only)");
      } else if (!isTranscoded && shouldAvoidServerTranscode(rawUrl) && compatModeRequested) {
        setStatusText("Playback failed (compatibility mode needs LAN-reachable transcode server)");
      } else {
      setStatusText("Playback failed");
      }
      if (isTranscoded) {
        diagnoseTranscodeFailure(playbackUrl).then((info) => {
          if (!info) return;
          const lower = info.toLowerCase();
          const networkBlocked =
            lower.includes("operation timed out") ||
            lower.includes("connection to tcp") ||
            lower.includes("error opening input file");
          if (networkBlocked) {
            // Domain cannot reach LAN source for server-side transcode.
            // Fall back to normal mode and stop auto-retrying compat.
            setCompatibilityDisabled(true);
            setCompatModeRequested(false);
            setFallbackPlaybackUrl("");
            setStatusText("Compatibility mode unavailable on domain (LAN source unreachable). Switched to normal mode.");
            return;
          }
          setStatusText(`Playback failed (${info})`);
        });
      }
      onTrackActivityRef.current?.("movie_playback_failed", {
        movie_id: String(movie?.id || ""),
      });
    };

    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("pause", handlePause);
    video.addEventListener("seeked", handleSeeked);
    video.addEventListener("play", handlePlay);
    video.addEventListener("ended", handleEnded);
    video.addEventListener("error", handleError);
    video.addEventListener("timeupdate", handleTimeUpdate);
    setIsPaused(video.paused);

    intervalRef.current = setInterval(() => {
      if (!video.paused && !video.ended) postProgress("interval");
    }, 20000);

    const onPageHide = () => postProgress("pagehide");
    const onForcePause = () => {
      const active = videoRef.current;
      if (!active || active.paused || active.ended) return;
      active.pause();
      postProgress("pause");
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") onPageHide();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("beforeunload", onPageHide);
    window.addEventListener("movie-force-pause", onForcePause);

    return () => {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
      postProgress("unmount");
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("seeked", handleSeeked);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("ended", handleEnded);
      video.removeEventListener("error", handleError);
      video.removeEventListener("timeupdate", handleTimeUpdate);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("beforeunload", onPageHide);
      window.removeEventListener("movie-force-pause", onForcePause);
    };
  }, [fallbackPlaybackUrl, movie?.id, movie?.playbackUrl, movie?.source?.rawUrl, postComplete, postProgress, replayToken, seekNonce, startFrom]);

  const favoriteActive = Boolean(movie?.isFavorite);
  const hasPlayableMovie = Boolean(movie?.playbackUrl);
  const isTranscodedPlayback = isTranscodePlaybackUrl(fallbackPlaybackUrl || movie?.playbackUrl);
  const rawSourceUrl = String(movie?.source?.rawUrl || "");
  const privateHostedMode = shouldAvoidServerTranscode(rawSourceUrl);
  const likelyUnsupportedAudio = hasLikelyUnsupportedAudioInUrl(rawSourceUrl);
  const showPlayAction = isPaused || !hasPlayableMovie;
  const watchedSeconds = Number(playbackSeconds || movie?.progress?.positionSeconds || 0);
  const durationSeconds = Number(movie?.progress?.durationSeconds || movie?.runtimeSeconds || 0);
  const watchedPercent = Number(movie?.progress?.progressPercent || 0);
  const watchTimeText = `${formatClock(watchedSeconds)} / ${formatClock(durationSeconds)}`;
  const watchProgressText = watchedPercent > 0 ? `${Math.round(watchedPercent)}% watched` : "Not started";
  const scrubDuration = Math.max(0, toSeconds(durationSeconds || movie?.runtimeSeconds || 0));
  const scrubCurrent = Math.min(scrubDuration || 0, Math.max(0, toSeconds(scrubValue == null ? watchedSeconds : scrubValue)));
  const handleTogglePlayPause = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused || video.ended) {
      if (video.ended) {
        try {
          video.currentTime = 0;
        } catch {
          // ignore seek failures
        }
      }
      video.play().catch(() => {});
      return;
    }
    video.pause();
  }, []);

  const jumpBySeconds = useCallback(
    (delta) => {
      const video = videoRef.current;
      if (!video) return;
      const base = toSeconds(video.currentTime) + toSeconds(transcodeOffsetRef.current);
      const target = Math.max(0, base + toSeconds(delta));
      if (isTranscodedPlayback) {
        queueTranscodeSeek(target);
        return;
      }
      try {
        video.currentTime = target;
      } catch {
        // ignore seek failures
      }
    },
    [isTranscodedPlayback]
  );

  const jumpToSeconds = useCallback(
    (targetSeconds) => {
      const target = Math.max(0, toSeconds(targetSeconds));
      const video = videoRef.current;
      if (!video) return;
      if (isTranscodedPlayback) {
        queueTranscodeSeek(target);
        setScrubValue(null);
        return;
      }
      try {
        video.currentTime = target;
      } catch {
        // ignore seek failures
      }
      setScrubValue(null);
    },
    [isTranscodedPlayback, queueTranscodeSeek]
  );

  const toggleCompatibilityMode = useCallback(() => {
    const rawUrl = String(movie?.source?.rawUrl || "").trim();
    if (!rawUrl) return;
    const compatibilityUrl = resolveCompatibilityPlaybackUrl(rawUrl);
    const video = videoRef.current;
    const currentAbs = video
      ? toSeconds(video.currentTime) + toSeconds(transcodeOffsetRef.current)
      : toSeconds(playbackSeconds || movie?.progress?.positionSeconds || 0);
    seekStartFromRef.current = currentAbs;
    if (isTranscodedPlayback) {
      setCompatibilityDisabled(true);
      setCompatModeRequested(false);
      setFallbackPlaybackUrl("");
      setStatusText("Switched to normal mode");
      return;
    }
    if (!compatibilityUrl) {
      setStatusText("Compatibility mode unavailable (gateway not configured for private source)");
      return;
    }
    setCompatibilityDisabled(false);
    setCompatModeRequested(true);
    setFallbackPlaybackUrl(compatibilityUrl);
    if (privateHostedMode) {
      setStatusText("Trying compatibility mode (requires transcode server access to LAN source)...");
    } else {
      setStatusText("Switching to compatibility mode...");
    }
  }, [isTranscodedPlayback, movie?.progress?.positionSeconds, movie?.source?.rawUrl, playbackSeconds, privateHostedMode]);

  return (
    <section className={styles.playerWrap}>
      <video ref={videoRef} className={styles.video} controls playsInline preload="metadata" />
      <div className={styles.moviePlayerControlsRow}>
        <div className={styles.moviePlayerButtons}>
          <button type="button" className={`${styles.movieNavBtn} ${styles.movieNavBtnInactive}`} onClick={onBackToList}>
          <ChevronLeft size={15} />
          <span className={styles.movieBtnText}>Back to Movie List</span>
          </button>
          <button
            type="button"
            className={`${styles.movieNavBtn} ${showPlayAction ? styles.movieNavBtnInactive : styles.movieNavBtnActive}`}
            onClick={handleTogglePlayPause}
            disabled={!hasPlayableMovie}
            aria-label={showPlayAction ? "Play" : "Pause"}
            title={showPlayAction ? "Play" : "Pause"}
          >
            {showPlayAction ? <Play size={15} /> : <Pause size={15} />}
            <span className={styles.movieBtnText}>{showPlayAction ? "Play" : "Pause"}</span>
          </button>
          <button type="button" className={`${styles.movieNavBtn} ${styles.movieNavBtnInactive}`} onClick={() => onRestart?.(movie)}>
            <RotateCcw size={15} />
            <span className={styles.movieBtnText}>Restart</span>
          </button>
          <button
            type="button"
            className={`${styles.movieNavBtn} ${styles.movieNavBtnInactive}`}
            onClick={() => jumpBySeconds(-10)}
            disabled={!hasPlayableMovie}
          >
            <Rewind size={15} />
            <span className={styles.movieBtnText}>-10s</span>
          </button>
          <button
            type="button"
            className={`${styles.movieNavBtn} ${styles.movieNavBtnInactive}`}
            onClick={() => jumpBySeconds(10)}
            disabled={!hasPlayableMovie}
          >
            <FastForward size={15} />
            <span className={styles.movieBtnText}>+10s</span>
          </button>
          <button
            type="button"
            className={`${styles.movieNavBtn} ${styles.movieNavBtnInactive}`}
            onClick={() => onMarkComplete?.(movie)}
          >
            <CheckCircle2 size={15} />
            <span className={styles.movieBtnText}>Mark Watched</span>
          </button>
          <button
            type="button"
            className={`${styles.movieNavBtn} ${styles.movieNavBtnInactive}`}
            onClick={toggleCompatibilityMode}
            disabled={!rawSourceUrl}
          >
            <span className={styles.movieBtnText}>{isTranscodedPlayback ? "Normal Mode" : "Compatibility Mode"}</span>
          </button>
          <button
            type="button"
            className={`${styles.movieFavoriteBtn} ${favoriteActive ? styles.movieFavoriteBtnActive : styles.movieFavoriteBtnInactive}`}
            onClick={() => onToggleFavorite?.(movie)}
            aria-label={favoriteActive ? "Favorited" : "Add Favorite"}
            title={favoriteActive ? "Favorited" : "Add Favorite"}
          >
            <Heart size={15} fill={favoriteActive ? "currentColor" : "none"} />
            <span className={styles.movieBtnText}>{favoriteActive ? "Favorited" : "Add Favorite"}</span>
          </button>
        </div>
      </div>
      {scrubDuration > 0 ? (
        <div className={styles.playerInfoPanel} style={{ marginTop: 8 }}>
          <input
            type="range"
            min={0}
            max={scrubDuration}
            step={1}
            value={scrubCurrent}
            onChange={(e) => setScrubValue(Number(e.target.value || 0))}
            onMouseUp={(e) => jumpToSeconds(Number(e.currentTarget.value || 0))}
            onTouchEnd={(e) => jumpToSeconds(Number(e.currentTarget.value || 0))}
          />
          <div className={styles.playerInfoTop}>
            <span className={styles.playerInfoPill}>{formatClock(scrubCurrent)}</span>
            <span className={styles.playerInfoPill}>{formatClock(scrubDuration)}</span>
          </div>
        </div>
      ) : null}
      <div className={styles.playerInfoPanel}>
        <div className={styles.playerInfoTop}>
          <span className={styles.playerInfoPill}>{movie?.releaseYear || "Year N/A"}</span>
          <span className={styles.playerInfoPill}>{watchTimeText}</span>
          <span className={styles.playerInfoPill}>{watchProgressText}</span>
        </div>
        <p className={styles.playerStatusText}>
          Status:
          {" "}
          <span className={styles.playerStatusValue}>{statusText}</span>
        </p>
        <p className={styles.playerHintText}>Resume starts when progress is at least 30s. Watched is 95%+.</p>
        {isTranscodedPlayback ? (
          <p className={styles.playerHintText}>Compatibility mode active (AAC fallback). Use -10s/+10s for reliable seeking.</p>
        ) : null}
        {!isTranscodedPlayback && privateHostedMode && likelyUnsupportedAudio ? (
          <p className={styles.playerHintText}>This source likely has unsupported browser audio codec. Try Compatibility Mode.</p>
        ) : null}
      </div>
    </section>
  );
}
