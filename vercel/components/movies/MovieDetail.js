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

export default function MovieDetail({ movie, isTvMode = false, mode = "full" }) {
  if (!movie) {
    return (
      <section className={styles.detailWrap}>
        <p className={styles.empty}>Select a movie to view details.</p>
      </section>
    );
  }

  const detailRows = [
    movie.imdbReleaseDate ? { label: "Release Date", value: movie.imdbReleaseDate } : null,
    joinList(movie.imdbGenres) ? { label: "Genres", value: joinList(movie.imdbGenres) } : null,
    joinList(movie.imdbDirectors) ? { label: "Directors", value: joinList(movie.imdbDirectors) } : null,
    joinList(movie.imdbWriters) ? { label: "Writers", value: joinList(movie.imdbWriters) } : null,
    joinList(movie.imdbStars) ? { label: "Stars", value: joinList(movie.imdbStars) } : null,
    joinList(movie.imdbCountries) ? { label: "Countries", value: joinList(movie.imdbCountries) } : null,
    joinList(movie.imdbLanguages) ? { label: "Languages", value: joinList(movie.imdbLanguages) } : null,
  ].filter(Boolean);

  const showPoster = mode !== "metadata";
  const showHeaderContent = mode !== "poster";

  return (
    <section className={`${styles.detailWrap} ${isTvMode ? styles.detailWrapTv : ""}`}>
      {showPoster ? (
        <div className={`${styles.detailPosterCol} ${isTvMode ? styles.detailPosterColTv : ""}`}>
          <div
            className={`${styles.detailPosterWrap} ${isTvMode ? styles.detailPosterWrapTv : ""}`}
            tabIndex={isTvMode ? 0 : undefined}
            data-tv-focusable={isTvMode ? "true" : undefined}
            data-tv-focus-scope={isTvMode ? "movie-content" : undefined}
            data-tv-focus-id={isTvMode ? "movie-detail-poster" : undefined}
            data-tv-nav-row={isTvMode ? "1" : undefined}
            data-tv-nav-col={isTvMode ? "1" : undefined}
          >
            {movie.posterUrl ? (
              <img className={styles.detailPoster} src={movie.posterUrl} alt={`${movie.title} poster`} loading="lazy" />
            ) : movie.backdropUrl ? (
              <img className={styles.detailPoster} src={movie.backdropUrl} alt={`${movie.title} artwork`} loading="lazy" />
            ) : (
              <div className={styles.detailPosterFallback} aria-hidden="true" />
            )}
          </div>
        </div>
      ) : null}

      <div className={`${styles.detailContentCol} ${isTvMode ? styles.detailContentColTv : ""}`}>
        {showHeaderContent ? (
          <>
            <h2
              className={styles.detailTitle}
              tabIndex={isTvMode ? 0 : undefined}
              data-tv-focusable={isTvMode ? "true" : undefined}
              data-tv-focus-scope={isTvMode ? "movie-content" : undefined}
              data-tv-focus-id={isTvMode ? "movie-detail-title" : undefined}
              data-tv-nav-row={isTvMode ? "2" : undefined}
              data-tv-nav-col={isTvMode ? "0" : undefined}
            >
              {movie.title}
            </h2>
            <p
              className={styles.synopsis}
              tabIndex={isTvMode ? 0 : undefined}
              data-tv-focusable={isTvMode ? "true" : undefined}
              data-tv-focus-scope={isTvMode ? "movie-content" : undefined}
              data-tv-focus-id={isTvMode ? "movie-detail-synopsis" : undefined}
              data-tv-nav-row={isTvMode ? "3" : undefined}
              data-tv-nav-col={isTvMode ? "0" : undefined}
            >
              {movie.synopsis || "No synopsis available."}
            </p>
            <div
              className={`${styles.detailMetaChips} ${isTvMode ? styles.detailMetaChipsTv : ""}`}
              tabIndex={isTvMode ? 0 : undefined}
              data-tv-focusable={isTvMode ? "true" : undefined}
              data-tv-focus-scope={isTvMode ? "movie-content" : undefined}
              data-tv-focus-id={isTvMode ? "movie-detail-chips" : undefined}
              data-tv-nav-row={isTvMode ? "4" : undefined}
              data-tv-nav-col={isTvMode ? "0" : undefined}
            >
              {movie.releaseYear ? <span className={styles.detailChip}>{movie.releaseYear}</span> : null}
              {movie.contentRating ? <span className={styles.detailChip}>{movie.contentRating}</span> : null}
              {formatRating(movie.imdbRating) ? <span className={styles.detailChip}>IMDb {formatRating(movie.imdbRating)}</span> : null}
              {formatVotes(movie.imdbVotes) ? <span className={styles.detailChip}>{formatVotes(movie.imdbVotes)} votes</span> : null}
            </div>
          </>
        ) : null}

        <div className={`${styles.detailInfoList} ${isTvMode ? styles.detailInfoListTv : ""}`}>
          {detailRows.map((row, index) => (
            <p
              key={row.label}
              className={styles.detailInfoRow}
              tabIndex={isTvMode ? 0 : undefined}
              data-tv-focusable={isTvMode ? "true" : undefined}
              data-tv-focus-scope={isTvMode ? "movie-content" : undefined}
              data-tv-focus-id={isTvMode ? `movie-detail-row-${index}` : undefined}
              data-tv-nav-row={isTvMode ? String(index + 5) : undefined}
              data-tv-nav-col={isTvMode ? "0" : undefined}
            >
              <strong>{row.label}:</strong> <span>{row.value}</span>
            </p>
          ))}
          {movie.imdbUrl ? (
            <a
              className={styles.detailLink}
              href={movie.imdbUrl}
              target="_blank"
              rel="noreferrer noopener"
              data-tv-focusable={isTvMode ? "true" : undefined}
              data-tv-focus-scope={isTvMode ? "movie-content" : undefined}
              data-tv-focus-id={isTvMode ? "movie-detail-imdb-link" : undefined}
              data-tv-nav-row={isTvMode ? String(detailRows.length + 5) : undefined}
              data-tv-nav-col={isTvMode ? "0" : undefined}
            >
              View on IMDb
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
}
