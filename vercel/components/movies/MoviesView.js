"use client";

import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import MovieDetail from "./MovieDetail";
import MovieCard from "./MovieCard";
import MovieGrid from "./MovieGrid";
import MoviePlayer from "./MoviePlayer";
import styles from "./movies.module.css";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "../ui/pagination";
import { deriveWatchState } from "../../lib/movieProgress";

const LAST_MODE_KEY = "iptv:v1:last-mode";
const LAST_MOVIE_SLUG_KEY = "iptv:v1:last-movie-slug";
const DEFAULT_MOVIES_PAGE_SIZE = 24;
const CONTINUE_PAGE_SIZE = 6;
const MOVIES_GRID_MAX_PAGE_SIZE = 60;

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

function buildPageItems(currentPage, totalPages) {
  const total = Math.max(1, Number(totalPages || 1));
  const current = Math.min(Math.max(1, Number(currentPage || 1)), total);
  const keep = new Set([1, total, current - 1, current, current + 1]);
  const sorted = Array.from(keep)
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= total)
    .sort((a, b) => a - b);
  const out = [];
  for (let i = 0; i < sorted.length; i += 1) {
    const value = sorted[i];
    const prev = sorted[i - 1];
    if (i > 0 && value - prev > 1) out.push(`ellipsis-${prev}-${value}`);
    out.push(value);
  }
  return out;
}

export default function MoviesView({
  variant = "browse",
  externalFilterResetToken = 0,
  initialMovies = [],
  movieCategories = [],
  initialContinueWatching = [],
  initialPage = 1,
  initialPageSize = DEFAULT_MOVIES_PAGE_SIZE,
  totalMovies = 0,
  totalMoviePages = 1,
  isPageLoading = false,
  onPageChange,
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
  onMoviesSnapshotChange,
  onTrackActivity,
}) {
  const [movies, setMovies] = useState(() => (Array.isArray(initialMovies) ? initialMovies : []));
  const [search, setSearch] = useState("");
  const [moviesPage, setMoviesPage] = useState(() => Math.max(1, Number(initialPage || 1)));
  const [moviesPageSize, setMoviesPageSize] = useState(() => Math.max(1, Number(initialPageSize || DEFAULT_MOVIES_PAGE_SIZE)));
  const [continuePage, setContinuePage] = useState(1);
  const [isTouchContinueUi, setIsTouchContinueUi] = useState(false);
  const moviesSectionRef = useRef(null);
  const watchPlayerColRef = useRef(null);
  const hasFilterScrollMountedRef = useRef(false);
  const hasTriggeredInitialPageLoadRef = useRef(false);
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
    setMoviesPage(Math.max(1, Number(initialPage || 1)));
  }, [initialPage]);

  useEffect(() => {
    setMoviesPageSize(Math.max(1, Number(initialPageSize || DEFAULT_MOVIES_PAGE_SIZE)));
  }, [initialPageSize]);

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
    onMoviesSnapshotChange?.(movies);
  }, [movies, onMoviesSnapshotChange]);

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
    if (normalizedMode === "watched") return movies.filter((movie) => String(movie?.watchState || "") === "watched");
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
    return movies
      .filter((movie) => movie.watchState === "continue")
      .sort((a, b) => new Date(b?.progress?.updatedAt || 0).getTime() - new Date(a?.progress?.updatedAt || 0).getTime())
      .slice(0, 60);
  }, [movies]);

  const scrollToMoviesSection = useCallback((behavior = "smooth") => {
    if (typeof window === "undefined") return;
    const section = moviesSectionRef.current;
    if (!section) return;
    const navbarOffset = 74;
    const top = Math.max(0, section.getBoundingClientRect().top + window.scrollY - navbarOffset);
    window.scrollTo({ top, behavior });
  }, []);

  const handleGridMetricsChange = useCallback((metrics) => {
    const columns = Math.max(1, Number(metrics?.columns || 1));
    const rows = Math.max(1, Math.ceil(DEFAULT_MOVIES_PAGE_SIZE / columns));
    const nextPageSize = Math.max(
      columns,
      Math.min(MOVIES_GRID_MAX_PAGE_SIZE, columns * rows)
    );

    startTransition(() => {
      setMoviesPageSize((prev) => (prev === nextPageSize ? prev : nextPageSize));
    });
  }, []);

  const hasClientFilters =
    Boolean(String(search || "").trim()) ||
    (showInlineFilters ? String(categorySlug || "").trim().toLowerCase() !== "all" : false) ||
    (!showInlineFilters &&
      (Boolean(String(filterCategorySlug || "").trim()) ||
        Boolean(String(filterGenreSlug || "").trim()) ||
        Boolean(String(filterLanguageSlug || "").trim()) ||
        Boolean(String(filterYear || "").trim()) ||
        String(filterMode || "all").toLowerCase() !== "all"));
  const totalFilteredMovies = hasClientFilters ? filteredMovies.length : Number(totalMovies || filteredMovies.length);
  const totalPages = hasClientFilters
    ? Math.max(1, Math.ceil(filteredMovies.length / moviesPageSize))
    : Math.max(1, Number(totalMoviePages || 1));
  const currentPage = Math.min(Math.max(1, Number(moviesPage || 1)), totalPages);
  const pageItems = useMemo(() => buildPageItems(currentPage, totalPages), [currentPage, totalPages]);
  const totalContinuePages = Math.max(1, Math.ceil(continueWatching.length / CONTINUE_PAGE_SIZE));
  const currentContinuePage = Math.min(Math.max(1, Number(continuePage || 1)), totalContinuePages);
  const continuePageItems = useMemo(
    () => buildPageItems(currentContinuePage, totalContinuePages),
    [currentContinuePage, totalContinuePages]
  );
  const continuePagedMovies = useMemo(() => {
    const start = (currentContinuePage - 1) * CONTINUE_PAGE_SIZE;
    return continueWatching.slice(start, start + CONTINUE_PAGE_SIZE);
  }, [continueWatching, currentContinuePage]);
  const continueStripMovies = isTouchContinueUi ? continueWatching : continuePagedMovies;
  const pagedMovies = useMemo(() => {
    if (!hasClientFilters) return filteredMovies;
    const start = (currentPage - 1) * moviesPageSize;
    return filteredMovies.slice(start, start + moviesPageSize);
  }, [filteredMovies, currentPage, hasClientFilters, moviesPageSize]);

  useEffect(() => {
    setMoviesPage(1);
  }, [search, filterMode, filterCategorySlug, filterGenreSlug, filterLanguageSlug, filterYear, categorySlug, showInlineFilters]);

  useEffect(() => {
    if (variant !== "browse") return;
    if (hasClientFilters) return;
    if (!hasTriggeredInitialPageLoadRef.current) {
      hasTriggeredInitialPageLoadRef.current = true;
      return;
    }
    onPageChange?.(currentPage, moviesPageSize);
  }, [currentPage, hasClientFilters, moviesPageSize, onPageChange, variant]);

  useEffect(() => {
    if (moviesPage > totalPages) setMoviesPage(totalPages);
  }, [moviesPage, totalPages]);

  useEffect(() => {
    if (continuePage > totalContinuePages) setContinuePage(totalContinuePages);
  }, [continuePage, totalContinuePages]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const media = window.matchMedia("(max-width: 640px), (hover: none) and (pointer: coarse)");
    const sync = () => setIsTouchContinueUi(Boolean(media.matches));
    sync();
    media.addEventListener?.("change", sync);
    return () => media.removeEventListener?.("change", sync);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (variant !== "watch") return;
    const player = watchPlayerColRef.current;
    if (!player) return;
    const navbarOffset = 92;
    let rafId = 0;
    let timerId = 0;

    const scrollPlayerIntoView = () => {
      const top = Math.max(0, player.getBoundingClientRect().top + window.scrollY - navbarOffset);
      window.scrollTo({ top, behavior: "smooth" });
    };

    rafId = window.requestAnimationFrame(() => {
      scrollPlayerIntoView();
      timerId = window.setTimeout(scrollPlayerIntoView, 140);
    });

    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(timerId);
    };
  }, [variant, selectedMovieId]);

  useEffect(() => {
    setSearch("");
    setMoviesPage(1);
    if (showInlineFilters) setCategorySlug("all");
  }, [externalFilterResetToken, showInlineFilters]);

  useEffect(() => {
    if (!hasFilterScrollMountedRef.current) {
      hasFilterScrollMountedRef.current = true;
      return;
    }
    scrollToMoviesSection();
  }, [filterMode, filterCategorySlug, filterGenreSlug, filterLanguageSlug, filterYear, categorySlug, showInlineFilters, scrollToMoviesSection]);

  const activeFilterTags = useMemo(() => {
    const tags = [];
    if (String(search || "").trim()) tags.push({ key: "search", label: `Search: ${String(search || "").trim()}` });
    if (showInlineFilters) {
      if (String(categorySlug || "").trim().toLowerCase() !== "all") {
        tags.push({ key: "inline_category", label: `Category: ${String(categorySlug || "").trim()}` });
      }
    } else {
      if (String(filterCategorySlug || "").trim()) tags.push({ key: "category", label: `Category: ${String(filterCategorySlug || "").trim()}` });
      if (String(filterGenreSlug || "").trim()) tags.push({ key: "genre", label: `Genre: ${String(filterGenreSlug || "").trim()}` });
      if (String(filterLanguageSlug || "").trim()) tags.push({ key: "language", label: `Language: ${String(filterLanguageSlug || "").trim()}` });
      if (String(filterYear || "").trim()) tags.push({ key: "year", label: `Year: ${String(filterYear || "").trim()}` });
      if (String(filterMode || "all").toLowerCase() !== "all") tags.push({ key: "mode", label: `Mode: ${String(filterMode || "").trim()}` });
    }
    return tags;
  }, [search, categorySlug, filterCategorySlug, filterGenreSlug, filterLanguageSlug, filterYear, filterMode, showInlineFilters]);

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
    })
      .then(async (res) => {
        if (res.ok) return;
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.error || `Favorite save failed: HTTP ${res.status}`);
      })
      .catch((err) => {
        console.warn("movie favorite save failed", {
          movieId: id,
          requestedFavorite: nextFavorite,
          message: String(err?.message || err || "unknown"),
        });
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
        <div ref={watchPlayerColRef} className={styles.watchPlayerCol}>
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
        {continueWatching.length ? (
          <section className={`${styles.sectionCard} ${styles.sectionContinue}`}>
            <header className={styles.sectionTop}>
              <h3 className={styles.sectionTitle}>Continue Watching</h3>
              <span className={styles.sectionCount}>{continueWatching.length}</span>
            </header>
            <div className={styles.continueBody}>
              <div className={`${styles.continueStrip} ${isTouchContinueUi ? styles.continueStripTouch : ""}`}>
                {continueStripMovies.map((movie) => (
                  <div key={movie.id} className={styles.continueCardSlot}>
                    <MovieCard
                      movie={movie}
                      isActive={String(selectedMovieId || "") === String(movie.id || "")}
                      onSelect={handleSelectMovie}
                      onToggleFavorite={handleToggleFavorite}
                    />
                  </div>
                ))}
              </div>
              {totalContinuePages > 1 && !isTouchContinueUi ? (
                <div className={styles.continuePagination}>
                  <Pagination className={styles.paginationNav}>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          disabled={currentContinuePage <= 1}
                          onClick={() => setContinuePage((prev) => Math.max(1, prev - 1))}
                        />
                      </PaginationItem>
                      {continuePageItems.map((item) => (
                        <PaginationItem key={`continue-${String(item)}`}>
                          {typeof item === "number" ? (
                            <PaginationLink
                              isActive={item === currentContinuePage}
                              size="icon"
                              onClick={() => setContinuePage(item)}
                            >
                              {item}
                            </PaginationLink>
                          ) : (
                            <PaginationEllipsis />
                          )}
                        </PaginationItem>
                      ))}
                      <PaginationItem>
                        <PaginationNext
                          disabled={currentContinuePage >= totalContinuePages}
                          onClick={() => setContinuePage((prev) => Math.min(totalContinuePages, prev + 1))}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        <section className={`${styles.sectionCard} ${styles.sectionControls}`}>
          <header className={styles.sectionTop}>
            <h3 className={styles.sectionTitle}>Search & Filtering</h3>
            <span className={styles.sectionHint}>Live results</span>
          </header>
          <div className={styles.searchRow}>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search movies or genre:horror"
              className={`${styles.searchInput} ${styles.searchInputCentered}`}
            />
          </div>
          <div className={styles.filters}>
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
          </div>
          {!showInlineFilters ? (
            <div className={styles.filterSections}>
              <section className={styles.filterSection}>
                <header className={styles.filterSectionHead}>
                  <strong>Genres</strong>
                </header>
                <div className={styles.filterSectionBody}>
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
                </div>
              </section>

              <section className={styles.filterSection}>
                <header className={styles.filterSectionHead}>
                  <strong>Languages</strong>
                </header>
                <div className={styles.filterSectionBody}>
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
                </div>
              </section>

              <section className={styles.filterSection}>
                <header className={styles.filterSectionHead}>
                  <strong>Years</strong>
                </header>
                <div className={styles.filterSectionBody}>
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
                </div>
              </section>
            </div>
          ) : null}
          {!showInlineFilters ? (
            <div className={styles.activeFilterWrap}>
              <strong className={styles.activeFilterTitle}>Active Filters</strong>
              <div className={styles.activeFilterChips}>
                {activeFilterTags.length ? activeFilterTags.map((tag) => (
                  <button
                    type="button"
                    key={tag.key}
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
        </section>

        <section className={`${styles.sectionCard} ${styles.sectionMovies}`} ref={moviesSectionRef}>
          <header className={styles.sectionTop}>
            <h3 className={styles.sectionTitle}>Movies</h3>
            <span className={styles.sectionHint}>
              {totalFilteredMovies} result{totalFilteredMovies === 1 ? "" : "s"}
            </span>
          </header>
          <MovieGrid
            title=""
            movies={pagedMovies}
            selectedMovieId={selectedMovieId}
            onSelectMovie={handleSelectMovie}
            onToggleFavorite={handleToggleFavorite}
            onMetricsChange={handleGridMetricsChange}
          />
          <div className={styles.paginationBar}>
            <span className={styles.paginationInfo}>
              Showing {(currentPage - 1) * moviesPageSize + (pagedMovies.length ? 1 : 0)}-
              {Math.min((currentPage - 1) * moviesPageSize + pagedMovies.length, totalFilteredMovies)} of {totalFilteredMovies}
            </span>
            <div className={styles.paginationActions}>
              <Pagination className={styles.paginationNav}>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      disabled={currentPage <= 1}
                      onClick={() => {
                        setMoviesPage((prev) => Math.max(1, prev - 1));
                        scrollToMoviesSection();
                      }}
                    />
                  </PaginationItem>
                  {pageItems.map((item) => (
                    <PaginationItem key={String(item)}>
                      {typeof item === "number" ? (
                        <PaginationLink
                          isActive={item === currentPage}
                          size="icon"
                          onClick={() => {
                            setMoviesPage(item);
                            scrollToMoviesSection();
                          }}
                        >
                          {item}
                        </PaginationLink>
                      ) : (
                        <PaginationEllipsis />
                      )}
                    </PaginationItem>
                  ))}
                  <PaginationItem>
                    <PaginationNext
                      disabled={currentPage >= totalPages}
                      onClick={() => {
                        setMoviesPage((prev) => Math.min(totalPages, prev + 1));
                        scrollToMoviesSection();
                      }}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          </div>
          {isPageLoading && !hasClientFilters ? (
            <p className={styles.paginationInfo} style={{ marginTop: "10px" }}>
              Loading page {currentPage}...
            </p>
          ) : null}
        </section>
      </div>
      {activeFilterTags.length ? (
        <div className={styles.filterDock}>
          <div className={styles.filterDockInner}>
            <div className={styles.filterDockRow}>
              <div className={styles.filterDockChips}>
                {activeFilterTags.map((tag) => (
                  <button
                    key={tag.key}
                    type="button"
                    className={styles.activeFilterChip}
                    onClick={() => {
                      if (tag.key === "search") setSearch("");
                      if (tag.key === "inline_category") setCategorySlug("all");
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
                ))}
              </div>
              <button
                type="button"
                className={styles.filterDockClearBtn}
                onClick={() => {
                  setSearch("");
                  if (showInlineFilters) setCategorySlug("all");
                  onResetFilters?.();
                }}
              >
                Clear All Filters
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
