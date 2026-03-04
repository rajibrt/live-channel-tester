"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import MovieDetail from "./MovieDetail";
import MovieGrid from "./MovieGrid";
import MoviePlayer from "./MoviePlayer";
import styles from "./movies.module.css";
import { deriveWatchState } from "../../lib/movieProgress";

const LAST_MODE_KEY = "iptv:v1:last-mode";
const LAST_MOVIE_SLUG_KEY = "iptv:v1:last-movie-slug";

function text(value) {
  return String(value || "").trim();
}

function normalizeSearchValue(value) {
  return text(value).toLowerCase();
}

function parseMovieSearchQuery(rawSearch) {
  const normalized = normalizeSearchValue(rawSearch);
  const genreMatch = normalized.match(/\bgenres?:\s*([a-z0-9\-\s,]+)/i);
  const genreQuery = genreMatch ? text(genreMatch[1]).toLowerCase() : "";
  const cleanText = genreMatch ? normalized.replace(genreMatch[0], " ").trim() : normalized;
  return { textQuery: cleanText, genreQuery };
}

export default function MoviesView({
  variant = "browse",
  initialMovies = [],
  movieCategories = [],
  initialContinueWatching = [],
  initialSelectedMovieSlug = "",
  filterMode = "all",
  filterCategorySlug = "",
  filterGenreSlug = "",
  showGenreFilters = false,
  genreOptions = [],
  onSelectGenreFilter,
  showInlineFilters = true,
  onOpenMovieWatch,
  onBackToMovieList,
  onTrackActivity,
}) {
  const [movies, setMovies] = useState(() => (Array.isArray(initialMovies) ? initialMovies : []));
  const [search, setSearch] = useState("");
  const [categorySlug, setCategorySlug] = useState("all");
  const [selectedMovieId, setSelectedMovieId] = useState(() => {
    const preferred = Array.isArray(initialContinueWatching) && initialContinueWatching.length ? initialContinueWatching[0] : null;
    if (preferred?.id) return String(preferred.id);
    const first = Array.isArray(initialMovies) && initialMovies.length ? initialMovies[0] : null;
    return String(first?.id || "");
  });
  const [playerStartFrom, setPlayerStartFrom] = useState(null);
  const [playerReplayToken, setPlayerReplayToken] = useState(0);
  const selectedMovieSlug = text(initialSelectedMovieSlug).toLowerCase();

  useEffect(() => {
    if (!movies.length) return;
    if (!selectedMovieSlug) return;
    const row = movies.find((movie) => text(movie?.slug).toLowerCase() === selectedMovieSlug);
    if (!row?.id) return;
    setSelectedMovieId(String(row.id));
  }, [movies, selectedMovieSlug]);

  const selectedMovie = useMemo(
    () => movies.find((movie) => String(movie?.id || "") === String(selectedMovieId || "")) || null,
    [movies, selectedMovieId]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const slug = text(selectedMovie?.slug).toLowerCase();
    if (!slug) return;
    window.localStorage.setItem(LAST_MODE_KEY, "movies");
    window.localStorage.setItem(LAST_MOVIE_SLUG_KEY, slug);
  }, [selectedMovie?.slug]);

  useEffect(() => {
    if (selectedMovie) return;
    const first = movies[0] || null;
    if (first?.id) setSelectedMovieId(String(first.id));
  }, [movies, selectedMovie]);

  const categoryCounts = useMemo(() => {
    const map = new Map();
    for (const movie of movies) {
      const slugs = Array.isArray(movie?.categorySlugs) ? movie.categorySlugs : [];
      for (const slug of slugs) {
        const key = text(slug);
        if (!key) continue;
        map.set(key, (map.get(key) || 0) + 1);
      }
    }
    return map;
  }, [movies]);

  const categoriesWithCount = useMemo(() => {
    return (Array.isArray(movieCategories) ? movieCategories : []).map((category) => {
      const slug = text(category?.slug);
      return {
        ...category,
        slug,
        count: Number(categoryCounts.get(slug) || 0),
      };
    });
  }, [movieCategories, categoryCounts]);

  const filteredMovies = useMemo(() => {
    const { textQuery, genreQuery } = parseMovieSearchQuery(search);
    const normalizedMode = String(filterMode || "all").toLowerCase();
    const inlineCategory = String(categorySlug || "").trim().toLowerCase();
    const normalizedCategory = showInlineFilters
      ? inlineCategory && inlineCategory !== "all"
        ? inlineCategory
        : ""
      : String(filterCategorySlug || "").trim().toLowerCase();
    const normalizedGenre = showInlineFilters ? "" : String(filterGenreSlug || "").trim().toLowerCase();
    const recentMovies = movies
      .filter((movie) => Number(movie?.progress?.positionSeconds || 0) > 0)
      .sort((a, b) => new Date(b?.progress?.updatedAt || 0).getTime() - new Date(a?.progress?.updatedAt || 0).getTime());

    let list = movies;
    if (normalizedMode === "favorites") {
      list = movies.filter((movie) => Boolean(movie?.isFavorite));
    } else if (normalizedMode === "recent") {
      list = recentMovies;
    }

    return list.filter((movie) => {
      if (normalizedCategory && !movie.categorySlugs?.includes(normalizedCategory)) return false;
      const genresHay = (movie.imdbGenres || []).join(" ").toLowerCase();
      if (normalizedGenre) {
        const genreMatch = (movie.imdbGenres || []).some(
          (genre) => String(genre || "").trim().toLowerCase() === normalizedGenre
        );
        if (!genreMatch) return false;
      }
      if (genreQuery && !genresHay.includes(genreQuery)) return false;
      if (!textQuery) return true;
      const hay = `${movie.title || ""} ${movie.synopsis || ""} ${genresHay} ${(movie.imdbDirectors || []).join(" ")} ${(movie.imdbWriters || []).join(" ")} ${(movie.imdbStars || []).join(" ")} ${(movie.imdbCountries || []).join(" ")} ${(movie.imdbLanguages || []).join(" ")}`.toLowerCase();
      return hay.includes(textQuery);
    });
  }, [movies, search, filterCategorySlug, filterGenreSlug, filterMode, categorySlug, showInlineFilters]);

  const continueWatching = useMemo(() => {
    return movies
      .filter((movie) => movie.watchState === "continue")
      .sort((a, b) => new Date(b?.progress?.updatedAt || 0).getTime() - new Date(a?.progress?.updatedAt || 0).getTime())
      .slice(0, 12);
  }, [movies]);

  const upsertMovieProgress = useCallback((movieId, progress) => {
    const id = String(movieId || "");
    if (!id) return;
    setMovies((prev) =>
      prev.map((movie) => {
        if (String(movie?.id || "") !== id) return movie;
        const nextProgress = {
          ...(movie.progress || {}),
          ...(progress || {}),
          updatedAt: String(progress?.updatedAt || new Date().toISOString()),
        };
        return {
          ...movie,
          progress: nextProgress,
          watchState: deriveWatchState(nextProgress),
        };
      })
    );
  }, []);

  const handleSelectMovie = (movie) => {
    const id = String(movie?.id || "");
    const slug = text(movie?.slug).toLowerCase();
    if (!id) return;
    setSelectedMovieId(id);
    setPlayerStartFrom(null);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LAST_MODE_KEY, "movies");
      if (slug) window.localStorage.setItem(LAST_MOVIE_SLUG_KEY, slug);
    }
    if (slug) onOpenMovieWatch?.(slug);
    onTrackActivity?.("movie_select", {
      movie_id: id,
      movie_title: String(movie?.title || ""),
    });
  };

  const handleToggleFavorite = async (movie) => {
    const id = String(movie?.id || "");
    if (!id) return;
    const nextFavorite = !Boolean(movie?.isFavorite);

    setMovies((prev) => prev.map((row) => (String(row?.id || "") === id ? { ...row, isFavorite: nextFavorite } : row)));

    fetch(`/api/client/movies/${encodeURIComponent(id)}/favorite`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ favorite: nextFavorite }),
    }).catch(() => {
      setMovies((prev) => prev.map((row) => (String(row?.id || "") === id ? { ...row, isFavorite: !nextFavorite } : row)));
    });

    onTrackActivity?.("movie_favorite_toggle", {
      movie_id: id,
      favorite: nextFavorite,
    });
  };

  const handleMarkComplete = async (movie) => {
    const id = String(movie?.id || "");
    if (!id) return;
    try {
      const res = await fetch(`/api/client/movies/${encodeURIComponent(id)}/complete`, {
        method: "POST",
        headers: { "content-type": "application/json" },
      });
      if (!res.ok) return;
      upsertMovieProgress(id, {
        positionSeconds: Number(movie?.runtimeSeconds || movie?.progress?.durationSeconds || 0),
        durationSeconds: Number(movie?.runtimeSeconds || movie?.progress?.durationSeconds || 0),
        progressPercent: 100,
        isCompleted: true,
      });
    } catch {
      // ignore mark complete failures
    }
  };

  const handlePlayAction = useCallback((movie) => {
    const from = Number(movie?.progress?.positionSeconds || 0);
    setPlayerStartFrom(from > 0 ? from : null);
    setPlayerReplayToken((prev) => prev + 1);
  }, []);

  const handleRestartAction = useCallback((movie) => {
    setSelectedMovieId(String(movie?.id || ""));
    setPlayerStartFrom(0);
    setPlayerReplayToken((prev) => prev + 1);
  }, []);

  const handleMarkedComplete = useCallback(
    (id) => {
      upsertMovieProgress(id, {
        progressPercent: 100,
        isCompleted: true,
      });
    },
    [upsertMovieProgress]
  );

  if (variant === "watch") {
    return (
      <section className={`${styles.wrap} ${styles.wrapWatch}`}>
        <div className={styles.watchPlayerCol}>
          <MoviePlayer
            movie={selectedMovie}
            startFrom={playerStartFrom}
            replayToken={playerReplayToken}
            onRestart={handleRestartAction}
            onMarkComplete={handleMarkComplete}
            onToggleFavorite={handleToggleFavorite}
            onBackToList={() => onBackToMovieList?.()}
            onProgressSaved={upsertMovieProgress}
            onMarkedComplete={handleMarkedComplete}
            onTrackActivity={onTrackActivity}
          />
        </div>
        <aside className={styles.watchInfoCol}>
          <MovieDetail movie={selectedMovie} />
        </aside>
      </section>
    );
  }

  return (
    <section className={`${styles.wrap} ${styles.wrapBrowse}`}>
      <div className={styles.leftCol}>
        <div className={styles.filters}>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search movies or genre:horror"
            className={styles.searchInput}
          />
          {showInlineFilters ? (
            <>
              <button
                type="button"
                className={`${styles.filterBtn} ${categorySlug === "all" ? styles.filterBtnActive : ""}`}
                onClick={() => setCategorySlug("all")}
              >
                All ({movies.length})
              </button>
              {categoriesWithCount.map((category) => (
                <button
                  type="button"
                  key={category.slug || category.id}
                  className={`${styles.filterBtn} ${categorySlug === category.slug ? styles.filterBtnActive : ""}`}
                  onClick={() => setCategorySlug(category.slug)}
                >
                  {category.name} ({category.count})
                </button>
              ))}
            </>
          ) : null}
          {!showInlineFilters && showGenreFilters ? (
            <>
              <button
                type="button"
                className={`${styles.filterBtn} ${!filterGenreSlug ? styles.filterBtnActive : ""}`}
                onClick={() => onSelectGenreFilter?.("")}
              >
                All Genres
              </button>
              {(Array.isArray(genreOptions) ? genreOptions : []).map((genre) => {
                const key = String(genre?.key || "").trim().toLowerCase();
                return (
                  <button
                    type="button"
                    key={key || genre?.name}
                    className={`${styles.filterBtn} ${key && key === String(filterGenreSlug || "").trim().toLowerCase() ? styles.filterBtnActive : ""}`}
                    onClick={() => onSelectGenreFilter?.(key)}
                  >
                    {genre?.name} ({Number(genre?.count || 0)})
                  </button>
                );
              })}
            </>
          ) : null}
        </div>

        {continueWatching.length ? (
          <MovieGrid
            title="Continue Watching"
            movies={continueWatching}
            selectedMovieId={selectedMovieId}
            onSelectMovie={handleSelectMovie}
            onToggleFavorite={handleToggleFavorite}
          />
        ) : null}

        <MovieGrid
          title="Movies"
          movies={filteredMovies}
          selectedMovieId={selectedMovieId}
          onSelectMovie={handleSelectMovie}
          onToggleFavorite={handleToggleFavorite}
        />
      </div>
    </section>
  );
}
