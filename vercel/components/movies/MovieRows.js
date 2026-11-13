"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import MovieCard from "./MovieCard";
import styles from "./movies.module.css";

function Arrow({ dir }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {dir === "prev" ? <path d="M15 18l-6-6 6-6" /> : <path d="M9 6l6 6-6 6" />}
    </svg>
  );
}

function MovieRow({ title, total, movies, onSeeAll, selectedMovieId, onSelectMovie, onToggleFavorite }) {
  const stripRef = useRef(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  const sync = useCallback(() => {
    const el = stripRef.current;
    if (!el) return;
    setEdges({ start: el.scrollLeft < 8, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 8 });
  }, []);

  useEffect(() => {
    sync();
    const el = stripRef.current;
    if (!el) return undefined;
    el.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync);
    return () => {
      el.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
    };
  }, [sync, movies.length]);

  const scrollBy = (dir) => {
    const el = stripRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(240, el.clientWidth * 0.85), behavior: "smooth" });
  };

  if (!movies.length) return null;
  return (
    <section className={styles.movieRow}>
      <header className={styles.movieRowHead}>
        <h3 className={styles.movieRowTitle}>
          {title}
          {total ? <small>{total}</small> : null}
        </h3>
        {onSeeAll ? (
          <button type="button" className={styles.movieRowSeeAll} onClick={onSeeAll}>
            See all ›
          </button>
        ) : null}
      </header>
      <div className={styles.movieRowBody}>
        <button
          type="button"
          className={`${styles.movieRowArrow} ${styles.movieRowArrowPrev}`}
          onClick={() => scrollBy(-1)}
          disabled={edges.start}
          aria-label={`Scroll ${title} left`}
        >
          <Arrow dir="prev" />
        </button>
        <div className={styles.movieRowStrip} ref={stripRef}>
          {movies.map((movie) => (
            <MovieCard
              key={`${title}-${movie.id}`}
              movie={movie}
              isActive={String(selectedMovieId || "") === String(movie.id || "")}
              onSelect={onSelectMovie}
              onToggleFavorite={onToggleFavorite}
            />
          ))}
        </div>
        <button
          type="button"
          className={`${styles.movieRowArrow} ${styles.movieRowArrowNext}`}
          onClick={() => scrollBy(1)}
          disabled={edges.end}
          aria-label={`Scroll ${title} right`}
        >
          <Arrow dir="next" />
        </button>
      </div>
    </section>
  );
}

/**
 * Movies home: Continue Watching plus short rows (Recently added, Bangla, Hindi, …, genres).
 * "See all" opens the full list for that row through the normal filters.
 */
export default function MovieRows({
  continueWatching = [],
  selectedMovieId,
  onSelectMovie,
  onToggleFavorite,
  onSeeAll,
  onSeeContinue,
}) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(false);
  const [favorites, setFavorites] = useState({});

  const load = useCallback(() => {
    setError(false);
    fetch("/api/client/movies/rows", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((payload) => setRows(Array.isArray(payload?.rows) ? payload.rows : []))
      .catch(() => setError(true));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // favourites toggled here are shown at once in every row
  const withFav = (movie) =>
    Object.prototype.hasOwnProperty.call(favorites, String(movie.id)) ? { ...movie, isFavorite: favorites[String(movie.id)] } : movie;
  const toggleFavorite = (movie) => {
    setFavorites((prev) => ({ ...prev, [String(movie.id)]: !movie.isFavorite }));
    onToggleFavorite?.(movie);
  };

  return (
    <div className={styles.rowsStack}>
      {continueWatching.length ? (
        <MovieRow
          title="Continue Watching"
          movies={continueWatching.map(withFav)}
          onSeeAll={onSeeContinue}
          selectedMovieId={selectedMovieId}
          onSelectMovie={onSelectMovie}
          onToggleFavorite={toggleFavorite}
        />
      ) : null}
      {rows === null && !error
        ? [0, 1, 2].map((i) => (
            <section key={`sk-${i}`} className={styles.movieRow}>
              <header className={styles.movieRowHead}>
                <h3 className={styles.movieRowTitle}>&nbsp;</h3>
              </header>
              <div className={styles.rowSkeleton}>
                {Array.from({ length: 8 }).map((_, k) => (
                  <span key={k} />
                ))}
              </div>
            </section>
          ))
        : null}
      {error ? (
        <div className={styles.rowsError}>
          Could not load movies.
          <button type="button" className={styles.browseToolbarBtn} onClick={load}>
            Try again
          </button>
        </div>
      ) : null}
      {(rows || []).map((row) => (
        <MovieRow
          key={row.key}
          title={row.title}
          total={row.total}
          movies={(row.movies || []).map(withFav)}
          onSeeAll={() => onSeeAll?.(row)}
          selectedMovieId={selectedMovieId}
          onSelectMovie={onSelectMovie}
          onToggleFavorite={toggleFavorite}
        />
      ))}
    </div>
  );
}
