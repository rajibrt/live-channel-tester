"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, ChevronLeft, Heart, Pause, Play, RotateCcw } from "lucide-react";
import styles from "./movies.module.css";

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
  const [statusText, setStatusText] = useState("Ready");
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    onProgressSavedRef.current = onProgressSaved;
  }, [onProgressSaved]);

  useEffect(() => {
    onMarkedCompleteRef.current = onMarkedComplete;
  }, [onMarkedComplete]);

  useEffect(() => {
    onTrackActivityRef.current = onTrackActivity;
  }, [onTrackActivity]);

  const postProgress = useCallback(
    async (source) => {
      const id = String(movie?.id || "");
      if (!id) return;
      const video = videoRef.current;
      if (!video) return;

      const payload = {
        position_seconds: toSeconds(video.currentTime),
        duration_seconds: toSeconds(video.duration),
        source,
      };

      try {
        const res = await fetch(`/api/client/movies/${encodeURIComponent(id)}/progress`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
          keepalive: source === "pagehide" || source === "pause" || source === "seek",
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          onProgressSavedRef.current?.(id, {
            positionSeconds: Number(data?.position_seconds || 0),
            durationSeconds: Number(data?.duration_seconds || 0),
            progressPercent: Number(data?.progress_percent || 0),
            isCompleted: Boolean(data?.is_completed),
            updatedAt: new Date().toISOString(),
          });
        }
      } catch {
        // ignore save progress failures
      }
    },
    [movie?.id]
  );

  const postComplete = useCallback(async () => {
    const id = String(movie?.id || "");
    if (!id) return;
    try {
      const res = await fetch(`/api/client/movies/${encodeURIComponent(id)}/complete`, {
        method: "POST",
        headers: { "content-type": "application/json" },
      });
      if (!res.ok) return;
      onMarkedCompleteRef.current?.(id);
      onTrackActivityRef.current?.("movie_complete", { movie_id: id });
    } catch {
      // ignore completion failures
    }
  }, [movie?.id]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;

    video.pause();
    video.removeAttribute("src");
    video.load();

    if (!movie?.playbackUrl) {
      setStatusText("Select a movie with a playable source.");
      return undefined;
    }

    setStatusText("Loading...");
    video.src = movie.playbackUrl;
    video.load();

    const handleLoadedMetadata = () => {
      const fallbackStart = toSeconds(movie?.progress?.positionSeconds);
      const desiredStart = startFrom === null ? fallbackStart : toSeconds(startFrom);
      if (desiredStart > 0 && Number.isFinite(video.duration)) {
        video.currentTime = Math.min(desiredStart, Math.max(0, Math.floor(video.duration) - 1));
      }
      setStatusText("Playing");
      onTrackActivityRef.current?.("movie_playback_attempt", {
        movie_id: String(movie?.id || ""),
        source_label: String(movie?.source?.label || ""),
      });
      postProgress("start");
      video.play().catch(() => {});
    };

    const handlePause = () => {
      setStatusText("Paused");
      setIsPaused(true);
      postProgress("pause");
    };

    const handleSeeked = () => {
      postProgress("seek");
    };

    const handlePlay = () => {
      setStatusText("Playing");
      setIsPaused(false);
    };

    const handleEnded = () => {
      setStatusText("Completed");
      postComplete();
    };

    const handleError = () => {
      setStatusText("Playback failed");
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
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("beforeunload", onPageHide);
      window.removeEventListener("movie-force-pause", onForcePause);
    };
  }, [movie?.id, movie?.playbackUrl, postComplete, postProgress, replayToken, startFrom]);

  const favoriteActive = Boolean(movie?.isFavorite);
  const hasPlayableMovie = Boolean(movie?.playbackUrl);
  const showPlayAction = isPaused || !hasPlayableMovie;
  const watchedSeconds = Number(movie?.progress?.positionSeconds || 0);
  const durationSeconds = Number(movie?.progress?.durationSeconds || movie?.runtimeSeconds || 0);
  const watchedPercent = Number(movie?.progress?.progressPercent || 0);
  const watchTimeText = `${formatClock(watchedSeconds)} / ${formatClock(durationSeconds)}`;
  const watchProgressText = watchedPercent > 0 ? `${Math.round(watchedPercent)}% watched` : "Not started";
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
            onClick={() => onMarkComplete?.(movie)}
          >
            <CheckCircle2 size={15} />
            <span className={styles.movieBtnText}>Mark Watched</span>
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
      </div>
    </section>
  );
}
