"use client";

import MovieCard from "./MovieCard";
import styles from "./movies.module.css";

export default function MovieGrid({ title, movies, selectedMovieId, onSelectMovie, onToggleFavorite }) {
  return (
    <section className={styles.gridWrap}>
      {title ? <h3 className={styles.gridTitle}>{title}</h3> : null}
      {movies.length ? (
        <div className={styles.grid}>
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
