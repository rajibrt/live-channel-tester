"use client";

import { useEffect, useRef } from "react";
import MovieCard from "./MovieCard";
import styles from "./movies.module.css";

const DEFAULT_GRID_GAP = 10;
const DEFAULT_GRID_MIN_WIDTH = 170;

export default function MovieGrid({
  title,
  movies,
  selectedMovieId,
  onSelectMovie,
  onToggleFavorite,
  onMetricsChange,
}) {
  const gridRef = useRef(null);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    if (typeof onMetricsChange !== "function") return undefined;

    const grid = gridRef.current;
    if (!grid) return undefined;

    let frameId = 0;
    let observer = null;

    const measure = () => {
      cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        const currentGrid = gridRef.current;
        if (!currentGrid) return;

        const stylesMap = window.getComputedStyle(currentGrid);
        const gap =
          Number.parseFloat(stylesMap.getPropertyValue("--movie-grid-gap")) ||
          Number.parseFloat(stylesMap.columnGap) ||
          Number.parseFloat(stylesMap.gap) ||
          DEFAULT_GRID_GAP;
        const minWidth =
          Number.parseFloat(stylesMap.getPropertyValue("--movie-grid-min")) || DEFAULT_GRID_MIN_WIDTH;
        const columns = Math.max(1, Math.floor((currentGrid.clientWidth + gap) / (minWidth + gap)));
        const sampleCard = currentGrid.querySelector("[data-movie-card='true']");
        const cardHeight = sampleCard instanceof HTMLElement ? sampleCard.getBoundingClientRect().height : 0;
        const top = currentGrid.getBoundingClientRect().top;

        onMetricsChange({
          columns,
          gap,
          cardHeight,
          top,
          viewportHeight: window.innerHeight || 0,
        });
      });
    };

    measure();
    window.addEventListener("resize", measure);

    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(measure);
      observer.observe(grid);
    }

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", measure);
      observer?.disconnect();
    };
  }, [movies.length, onMetricsChange]);

  return (
    <section className={styles.gridWrap}>
      {title ? <h3 className={styles.gridTitle}>{title}</h3> : null}
      {movies.length ? (
        <div ref={gridRef} className={styles.grid}>
          {movies.map((movie) => (
            <MovieCard
              key={movie.id}
              movie={movie}
              isActive={String(selectedMovieId || "") === String(movie.id || "")}
              onSelect={onSelectMovie}
              onToggleFavorite={onToggleFavorite}
            />
          ))}
        </div>
      ) : (
        <p className={styles.empty}>No movies found for the current filter.</p>
      )}
    </section>
  );
}
