"use client";

import styles from "./movies.module.css";

function joinList(values) {
  return Array.isArray(values) ? values.filter(Boolean).join(", ") : "";
}

function formatVotes(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return "";
  return new Intl.NumberFormat("en-US").format(n);
}

function formatRating(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return "";
  return n.toFixed(1);
}

export default function MovieDetail({ movie }) {
  if (!movie) {
    return (
      <section className={styles.detailWrap}>
        <p className={styles.empty}>Select a movie to view details.</p>
      </section>
    );
  }

  return (
    <section className={styles.detailWrap}>
      <div className={styles.detailPosterWrap}>
        {movie.posterUrl ? (
          <img className={styles.detailPoster} src={movie.posterUrl} alt={`${movie.title} poster`} loading="lazy" />
        ) : movie.backdropUrl ? (
          <img className={styles.detailPoster} src={movie.backdropUrl} alt={`${movie.title} artwork`} loading="lazy" />
        ) : (
          <div className={styles.detailPosterFallback} aria-hidden="true" />
        )}
      </div>
      <h2 className={styles.detailTitle}>{movie.title}</h2>
      <p className={styles.synopsis}>{movie.synopsis || "No synopsis available."}</p>
      <div className={styles.detailMetaChips}>
        {movie.releaseYear ? <span className={styles.detailChip}>{movie.releaseYear}</span> : null}
        {movie.contentRating ? <span className={styles.detailChip}>{movie.contentRating}</span> : null}
        {formatRating(movie.imdbRating) ? <span className={styles.detailChip}>IMDb {formatRating(movie.imdbRating)}</span> : null}
        {formatVotes(movie.imdbVotes) ? <span className={styles.detailChip}>{formatVotes(movie.imdbVotes)} votes</span> : null}
      </div>

      <div className={styles.detailInfoList}>
        {movie.imdbReleaseDate ? (
          <p className={styles.detailInfoRow}>
            <strong>Release Date:</strong> <span>{movie.imdbReleaseDate}</span>
          </p>
        ) : null}
        {joinList(movie.imdbGenres) ? (
          <p className={styles.detailInfoRow}>
            <strong>Genres:</strong> <span>{joinList(movie.imdbGenres)}</span>
          </p>
        ) : null}
        {joinList(movie.imdbDirectors) ? (
          <p className={styles.detailInfoRow}>
            <strong>Directors:</strong> <span>{joinList(movie.imdbDirectors)}</span>
          </p>
        ) : null}
        {joinList(movie.imdbWriters) ? (
          <p className={styles.detailInfoRow}>
            <strong>Writers:</strong> <span>{joinList(movie.imdbWriters)}</span>
          </p>
        ) : null}
        {joinList(movie.imdbStars) ? (
          <p className={styles.detailInfoRow}>
            <strong>Stars:</strong> <span>{joinList(movie.imdbStars)}</span>
          </p>
        ) : null}
        {joinList(movie.imdbCountries) ? (
          <p className={styles.detailInfoRow}>
            <strong>Countries:</strong> <span>{joinList(movie.imdbCountries)}</span>
          </p>
        ) : null}
        {joinList(movie.imdbLanguages) ? (
          <p className={styles.detailInfoRow}>
            <strong>Languages:</strong> <span>{joinList(movie.imdbLanguages)}</span>
          </p>
        ) : null}
        {movie.imdbUrl ? (
          <a className={styles.detailLink} href={movie.imdbUrl} target="_blank" rel="noreferrer noopener">
            View on IMDb
          </a>
        ) : null}
      </div>
    </section>
  );
}
