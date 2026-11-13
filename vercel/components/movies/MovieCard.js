"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./movies.module.css";

function formatRuntime(seconds) {
  const total = Math.max(0, Number(seconds || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return "-";
}

function formatRating(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return "";
  return n.toFixed(1);
}

function formatVotes(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return "";
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(".0", "")}k`;
  return `${n}`;
}

function clampSummary(text) {
  const clean = String(text || "").trim();
  if (!clean) return "";
  if (clean.length <= 120) return clean;
  return `${clean.slice(0, 117)}...`;
}

export default function MovieCard({
  movie,
  isActive,
  onSelect,
  onToggleFavorite,
  isTvMode = false,
  tvFocusId = "",
  tvFocusScope = "",
  tvNavRow = "",
  tvNavCol = "",
}) {
  const watchLabel = movie?.watchState === "watched" ? "Watched" : movie?.watchState === "continue" ? "Continue" : "New";
  const rating = formatRating(movie?.imdbRating);
  const votes = formatVotes(movie?.imdbVotes);
  const genres = Array.isArray(movie?.imdbGenres) ? movie.imdbGenres.filter(Boolean).slice(0, 2).join(" • ") : "";
  const summary = clampSummary(movie?.synopsis);
  const qualityLabel = String(movie?.videoQuality || "").trim() || "HD";
  const progress = Math.max(0, Math.min(100, Number(movie?.progressPercent ?? movie?.progress?.progressPercent ?? 0)));
  const cardRef = useRef(null);
  const [isTouchUi, setIsTouchUi] = useState(false);
  const [touchOverlayActive, setTouchOverlayActive] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(hover: none), (pointer: coarse)");
    const sync = () => setIsTouchUi(Boolean(media.matches));
    sync();
    media.addEventListener?.("change", sync);
    return () => media.removeEventListener?.("change", sync);
  }, []);

  useEffect(() => {
    if (!touchOverlayActive) return;
    const handleDocPointer = (event) => {
      const target = event?.target;
      if (cardRef.current && target instanceof Node && !cardRef.current.contains(target)) {
        setTouchOverlayActive(false);
      }
    };
    document.addEventListener("touchstart", handleDocPointer, true);
    document.addEventListener("mousedown", handleDocPointer, true);
    return () => {
      document.removeEventListener("touchstart", handleDocPointer, true);
      document.removeEventListener("mousedown", handleDocPointer, true);
    };
  }, [touchOverlayActive]);

  return (
    <article
      ref={cardRef}
      data-movie-card="true"
      className={`${styles.card} ${isTvMode ? styles.cardTv : ""} ${isActive ? styles.cardActive : ""} ${touchOverlayActive ? styles.cardTouchActive : ""}`}
      role="button"
      tabIndex={0}
      data-tv-focusable={isTvMode ? "true" : undefined}
      data-tv-focus-id={isTvMode ? tvFocusId || `movie-card-${String(movie?.id || "")}` : undefined}
      data-tv-focus-scope={isTvMode ? tvFocusScope || "movie-content" : undefined}
      data-tv-active={isTvMode ? (isActive ? "true" : "false") : undefined}
      data-tv-nav-row={isTvMode && tvNavRow !== "" ? String(tvNavRow) : undefined}
      data-tv-nav-col={isTvMode && tvNavCol !== "" ? String(tvNavCol) : undefined}
      onClick={() => {
        cardRef.current?.focus();
        if (isTouchUi && !touchOverlayActive) {
          setTouchOverlayActive(true);
          return;
        }
        onSelect(movie);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(movie);
        }
      }}
      onBlur={() => {
        if (isTouchUi) setTouchOverlayActive(false);
      }}
    >
      <div className={styles.posterWrap}>
        {movie?.posterUrl ? (
          <img className={styles.poster} src={movie.posterUrl} alt={movie?.title || "Movie poster"} loading="lazy" />
        ) : (
          <div className={styles.poster} />
        )}

        <div className={styles.cardTopChips}>
          {rating ? <span className={styles.ratingChip}>{isTvMode ? "IMDb " : "★ "}{rating}</span> : null}
          {isTvMode ? <span className={styles.qualityChip}>{qualityLabel}</span> : null}
        </div>
        {!isTvMode ? (
          <button
            type="button"
            className={`${styles.cardHeart} ${movie?.isFavorite ? styles.cardHeartOn : ""}`}
            aria-label={movie?.isFavorite ? "Remove from favourites" : "Add to favourites"}
            title={movie?.isFavorite ? "Remove from favourites" : "Add to favourites"}
            onClick={(event) => {
              event.stopPropagation();
              onToggleFavorite(movie);
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 7.9 3.6 4.5 7 4.5c2 0 3.6 1.1 5 2.9 1.4-1.8 3-2.9 5-2.9 3.4 0 5.6 3.4 4.3 6.8-1.8 4.6-9.3 9.2-9.3 9.2z" />
            </svg>
          </button>
        ) : null}
        {!isTvMode && progress > 0 && progress < 100 ? (
          <span className={styles.cardProgress} aria-hidden="true">
            <span style={{ width: `${progress}%` }} />
          </span>
        ) : null}

        <div className={styles.hoverOverlay} aria-hidden="true">
          <div className={styles.playCircle}>
            <span className={styles.playTriangle}>▶</span>
          </div>
          {summary ? <p className={styles.overlaySummary}>{summary}</p> : null}
        </div>
      </div>

      {!isTvMode ? (
        <div className={`${styles.cardBody} ${styles.cardBodySlim}`}>
          <h3 className={styles.movieTitle}>{movie?.title || "Untitled"}</h3>
          <span className={styles.metaText}>
            {[movie?.releaseYear, genres.split(" • ")[0]].filter(Boolean).join(" · ") || "\u00a0"}
          </span>
        </div>
      ) : (
      <div className={styles.cardBody}>
        <h3 className={styles.movieTitle}>{movie?.title || "Untitled"}</h3>
        <div className={styles.metaRow}>
          <span className={styles.badge}>{watchLabel}</span>
          <span className={styles.metaText}>{movie?.releaseYear || "—"}</span>
        </div>
        <div className={styles.metaRow}>
          <small className={styles.metaText}>{formatRuntime(movie?.runtimeSeconds)}</small>
          {votes ? <small className={styles.metaText}>{votes} votes</small> : null}
        </div>
        {genres ? <p className={styles.genreText}>{genres}</p> : null}
        <div className={styles.metaRow}>
          <button
            type="button"
            className={styles.favoriteBtn}
            onClick={(event) => {
              event.stopPropagation();
              onToggleFavorite(movie);
            }}
          >
            {movie?.isFavorite ? "Unfavorite" : "Favorite"}
          </button>
        </div>
      </div>
      )}
    </article>
  );
}
