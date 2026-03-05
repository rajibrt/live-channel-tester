"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import MovieDetail from "./MovieDetail";
import MovieGrid from "./MovieGrid";
import MoviePlayer from "./MoviePlayer";
import styles from "./movies.module.css";
import { deriveWatchState } from "../../lib/movieProgress";

const LAST_MODE_KEY = "iptv:v1:last-mode";
const LAST_MOVIE_SLUG_KEY = "iptv:v1:last-movie-slug";
const MOVIES_PAGE_SIZE = 24;

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
  filterLanguageSlug = "",
  filterYear = "",
  genreOptions = [],
  languageOptions = [],
  yearOptions = [],
  onSelectGenreFilter,
  onSelectLanguageFilter,
  onSelectYearFilter,
  onSelectCategoryFilter,
  onSelectModeFilter,
  onResetFilters,
  showInlineFilters = true,
  onOpenMovieWatch,
  onBackToMovieList,
  onTrackActivity,
}) {
  const [movies, setMovies] = useState(() => (Array.isArray(initialMovies) ? initialMovies : []));
  const [search, setSearch] = useState("");
  const [moviesPage, setMoviesPage] = useState(1);
  const moviesSectionRef = useRef(null);
  const hasFilterScrollMountedRef = useRef(false);
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

  const { textQuery, genreQuery } = useMemo(() => parseMovieSearchQuery(search), [search]);
  const normalizedMode = String(filterMode || "all").toLowerCase();
  const inlineCategory = String(categorySlug || "").trim().toLowerCase();
  const normalizedCategory = showInlineFilters
    ? inlineCategory && inlineCategory !== "all"
      ? inlineCategory
      : ""
    : String(filterCategorySlug || "").trim().toLowerCase();
  const normalizedGenre = showInlineFilters ? "" : String(filterGenreSlug || "").trim().toLowerCase();
  const normalizedLanguage = showInlineFilters ? "" : String(filterLanguageSlug || "").trim().toLowerCase();
  const normalizedYear = showInlineFilters ? "" : String(filterYear || "").trim();

  const modeScopedMovies = useMemo(() => {
    const recentMovies = movies
      .filter((movie) => Number(movie?.progress?.positionSeconds || 0) > 0)
      .sort((a, b) => new Date(b?.progress?.updatedAt || 0).getTime() - new Date(a?.progress?.updatedAt || 0).getTime());
    if (normalizedMode === "favorites") return movies.filter((movie) => Boolean(movie?.isFavorite));
    if (normalizedMode === "recent") return recentMovies;
    return movies;
  }, [movies, normalizedMode]);

  const applyMovieFilters = useCallback(
    (list, options = {}) => {
      const {
        skipCategory = false,
        skipGenre = false,
        skipLanguage = false,
        skipYear = false,
        includeSearch = true,
      } = options;
      return list.filter((movie) => {
        if (!skipCategory && normalizedCategory && !movie.categorySlugs?.includes(normalizedCategory)) return false;
        if (!skipGenre && normalizedGenre) {
          const genreMatch = (movie.imdbGenres || []).some(
            (genre) => String(genre || "").trim().toLowerCase() === normalizedGenre
          );
          if (!genreMatch) return false;
        }
        if (!skipLanguage && normalizedLanguage) {
          const languageMatch = (movie.imdbLanguages || []).some(
            (language) => String(language || "").trim().toLowerCase() === normalizedLanguage
          );
          if (!languageMatch) return false;
        }
        if (!skipYear && normalizedYear && String(movie?.releaseYear || "") !== normalizedYear) return false;

        if (!includeSearch) return true;
        const genresHay = (movie.imdbGenres || []).join(" ").toLowerCase();
        if (genreQuery && !genresHay.includes(genreQuery)) return false;
        if (!textQuery) return true;
        const hay = `${movie.title || ""} ${movie.synopsis || ""} ${genresHay} ${(movie.imdbDirectors || []).join(" ")} ${(movie.imdbWriters || []).join(" ")} ${(movie.imdbStars || []).join(" ")} ${(movie.imdbCountries || []).join(" ")} ${(movie.imdbLanguages || []).join(" ")}`.toLowerCase();
        return hay.includes(textQuery);
      });
    },
    [genreQuery, normalizedCategory, normalizedGenre, normalizedLanguage, normalizedYear, textQuery]
  );

  const filteredMovies = useMemo(() => {
    return applyMovieFilters(modeScopedMovies, { includeSearch: true });
  }, [applyMovieFilters, modeScopedMovies]);

  const facetedGenreOptions = useMemo(() => {
    const base = applyMovieFilters(modeScopedMovies, { skipGenre: true, includeSearch: false });
    const map = new Map();
    for (const movie of base) {
      for (const rawGenre of Array.isArray(movie?.imdbGenres) ? movie.imdbGenres : []) {
        const name = String(rawGenre || "").trim();
        const key = name.toLowerCase();
        if (!key) continue;
        map.set(key, { key, name, count: Number((map.get(key)?.count || 0) + 1) });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  }, [applyMovieFilters, modeScopedMovies]);

  const facetedLanguageOptions = useMemo(() => {
    const base = applyMovieFilters(modeScopedMovies, { skipLanguage: true, includeSearch: false });
    const map = new Map();
    for (const movie of base) {
      for (const rawLanguage of Array.isArray(movie?.imdbLanguages) ? movie.imdbLanguages : []) {
        const name = String(rawLanguage || "").trim();
        const key = name.toLowerCase();
        if (!key) continue;
        map.set(key, { key, name, count: Number((map.get(key)?.count || 0) + 1) });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  }, [applyMovieFilters, modeScopedMovies]);

  const facetedYearOptions = useMemo(() => {
    const base = applyMovieFilters(modeScopedMovies, { skipYear: true, includeSearch: false });
    const map = new Map();
    for (const movie of base) {
      const year = Number(movie?.releaseYear || 0);
      if (!Number.isFinite(year) || year <= 0) continue;
      const key = String(Math.floor(year));
      map.set(key, { key, name: key, count: Number((map.get(key)?.count || 0) + 1) });
    }
    return Array.from(map.values()).sort((a, b) => Number(b.key) - Number(a.key));
  }, [applyMovieFilters, modeScopedMovies]);

  const continueWatching = useMemo(() => {
    return filteredMovies
      .filter((movie) => movie.watchState === "continue")
      .sort((a, b) => new Date(b?.progress?.updatedAt || 0).getTime() - new Date(a?.progress?.updatedAt || 0).getTime())
      .slice(0, 12);
  }, [filteredMovies]);

  const scrollToMoviesSection = useCallback((behavior = "smooth") => {
    if (typeof window === "undefined") return;
    const section = moviesSectionRef.current;
    if (!section) return;
    const navbarOffset = 74;
    const top = Math.max(0, section.getBoundingClientRect().top + window.scrollY - navbarOffset);
    window.scrollTo({ top, behavior });
  }, []);

  const totalFilteredMovies = filteredMovies.length;
  const totalPages = Math.max(1, Math.ceil(totalFilteredMovies / MOVIES_PAGE_SIZE));
  const currentPage = Math.min(Math.max(1, Number(moviesPage || 1)), totalPages);
  const pagedMovies = useMemo(() => {
    const start = (currentPage - 1) * MOVIES_PAGE_SIZE;
    return filteredMovies.slice(start, start + MOVIES_PAGE_SIZE);
  }, [filteredMovies, currentPage]);

  useEffect(() => {
    setMoviesPage(1);
  }, [search, filterMode, filterCategorySlug, filterGenreSlug, filterLanguageSlug, filterYear, categorySlug, showInlineFilters]);

  useEffect(() => {
    if (moviesPage > totalPages) setMoviesPage(totalPages);
  }, [moviesPage, totalPages]);

  useEffect(() => {
    if (!hasFilterScrollMountedRef.current) {
      hasFilterScrollMountedRef.current = true;
      return;
    }
    scrollToMoviesSection();
  }, [filterMode, filterCategorySlug, filterGenreSlug, filterLanguageSlug, filterYear, categorySlug, showInlineFilters, scrollToMoviesSection]);

  const activeFilterTags = useMemo(() => {
    if (showInlineFilters) return [];
    const tags = [];
    if (String(filterCategorySlug || "").trim()) tags.push({ key: "category", label: `Category: ${String(filterCategorySlug || "").trim()}` });
    if (String(filterGenreSlug || "").trim()) tags.push({ key: "genre", label: `Genre: ${String(filterGenreSlug || "").trim()}` });
    if (String(filterLanguageSlug || "").trim()) tags.push({ key: "language", label: `Language: ${String(filterLanguageSlug || "").trim()}` });
    if (String(filterYear || "").trim()) tags.push({ key: "year", label: `Year: ${String(filterYear || "").trim()}` });
    if (String(filterMode || "all").toLowerCase() !== "all") tags.push({ key: "mode", label: `Mode: ${String(filterMode || "").trim()}` });
    return tags;
  }, [filterCategorySlug, filterGenreSlug, filterLanguageSlug, filterYear, filterMode, showInlineFilters]);

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
          {!showInlineFilters ? (
            <>
              <button
                type="button"
                className={`${styles.filterBtn} ${!filterGenreSlug ? styles.filterBtnActive : ""}`}
                onClick={() => onSelectGenreFilter?.("")}
              >
                All Genres
              </button>
              {(Array.isArray(facetedGenreOptions) ? facetedGenreOptions : genreOptions).map((genre) => {
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
              <button
                type="button"
                className={`${styles.filterBtn} ${!filterLanguageSlug ? styles.filterBtnActive : ""}`}
                onClick={() => onSelectLanguageFilter?.("")}
              >
                All Languages
              </button>
              {(Array.isArray(facetedLanguageOptions) ? facetedLanguageOptions : languageOptions).map((language) => {
                const key = String(language?.key || "").trim().toLowerCase();
                return (
                  <button
                    type="button"
                    key={key || language?.name}
                    className={`${styles.filterBtn} ${key && key === String(filterLanguageSlug || "").trim().toLowerCase() ? styles.filterBtnActive : ""}`}
                    onClick={() => onSelectLanguageFilter?.(key)}
                  >
                    {language?.name} ({Number(language?.count || 0)})
                  </button>
                );
              })}
              <button
                type="button"
                className={`${styles.filterBtn} ${!filterYear ? styles.filterBtnActive : ""}`}
                onClick={() => onSelectYearFilter?.("")}
              >
                All Years
              </button>
              {(Array.isArray(facetedYearOptions) ? facetedYearOptions : yearOptions).map((yearRow) => {
                const key = String(yearRow?.key || "").trim();
                return (
                  <button
                    type="button"
                    key={key || yearRow?.name}
                    className={`${styles.filterBtn} ${key && key === String(filterYear || "").trim() ? styles.filterBtnActive : ""}`}
                    onClick={() => onSelectYearFilter?.(key)}
                  >
                    {yearRow?.name} ({Number(yearRow?.count || 0)})
                  </button>
                );
              })}
            </>
          ) : null}
        </div>
        {!showInlineFilters ? (
          <div className={styles.activeFilterWrap}>
            <strong className={styles.activeFilterTitle}>Active Filters</strong>
            <div className={styles.activeFilterChips}>
              {activeFilterTags.length ? activeFilterTags.map((tag) => (
                <button
                  key={tag.key}
                  type="button"
                  className={styles.activeFilterChip}
                  onClick={() => {
                    if (tag.key === "category") onSelectCategoryFilter?.("");
                    if (tag.key === "genre") onSelectGenreFilter?.("");
                    if (tag.key === "language") onSelectLanguageFilter?.("");
                    if (tag.key === "year") onSelectYearFilter?.("");
                    if (tag.key === "mode") onSelectModeFilter?.("all");
                  }}
                  title="Clear this filter"
                >
                  {tag.label} ×
                </button>
              )) : <span className={styles.activeFilterChip}>All Movies</span>}
              {activeFilterTags.length ? (
                <button type="button" className={styles.clearAllBtn} onClick={() => onResetFilters?.()}>
                  Clear All Filters
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        {continueWatching.length ? (
          <MovieGrid
            title="Continue Watching"
            movies={continueWatching}
            selectedMovieId={selectedMovieId}
            onSelectMovie={handleSelectMovie}
            onToggleFavorite={handleToggleFavorite}
          />
        ) : null}

        <div ref={moviesSectionRef}>
          <MovieGrid
            title="Movies"
            movies={pagedMovies}
            selectedMovieId={selectedMovieId}
            onSelectMovie={handleSelectMovie}
            onToggleFavorite={handleToggleFavorite}
          />
        </div>
        <div className={styles.paginationBar}>
          <span className={styles.paginationInfo}>
            Showing {(currentPage - 1) * MOVIES_PAGE_SIZE + (pagedMovies.length ? 1 : 0)}-
            {(currentPage - 1) * MOVIES_PAGE_SIZE + pagedMovies.length} of {totalFilteredMovies}
          </span>
          <div className={styles.paginationActions}>
            <button
              type="button"
              className={styles.paginationBtn}
              disabled={currentPage <= 1}
              onClick={() => {
                setMoviesPage((prev) => Math.max(1, prev - 1));
                scrollToMoviesSection();
              }}
            >
              Prev
            </button>
            <span className={styles.paginationInfo}>
              Page {currentPage}/{totalPages}
            </span>
            <button
              type="button"
              className={styles.paginationBtn}
              disabled={currentPage >= totalPages}
              onClick={() => {
                setMoviesPage((prev) => Math.min(totalPages, prev + 1));
                scrollToMoviesSection();
              }}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
