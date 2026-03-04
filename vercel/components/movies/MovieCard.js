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

export default function MovieCard({ movie, isActive, onSelect, onToggleFavorite }) {
  const watchLabel = movie?.watchState === "watched" ? "Watched" : movie?.watchState === "continue" ? "Continue" : "New";
  const rating = formatRating(movie?.imdbRating);
  const votes = formatVotes(movie?.imdbVotes);
  const genres = Array.isArray(movie?.imdbGenres) ? movie.imdbGenres.filter(Boolean).slice(0, 2).join(" • ") : "";
  const summary = clampSummary(movie?.synopsis);
  const qualityLabel = String(movie?.videoQuality || "").trim() || "HD";
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
      className={`${styles.card} ${isActive ? styles.cardActive : ""} ${touchOverlayActive ? styles.cardTouchActive : ""}`}
      role="button"
      tabIndex={0}
      onClick={() => {
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
          {rating ? <span className={styles.ratingChip}>IMDb {rating}</span> : null}
          <span className={styles.qualityChip}>{qualityLabel}</span>
        </div>

        <div className={styles.hoverOverlay} aria-hidden="true">
          <div className={styles.playCircle}>
            <span className={styles.playTriangle}>▶</span>
          </div>
          {summary ? <p className={styles.overlaySummary}>{summary}</p> : null}
        </div>
      </div>

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
    </article>
  );
}
