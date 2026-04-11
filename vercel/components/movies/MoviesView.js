"use client";

import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, Heart, Play, RotateCcw, Search, SlidersHorizontal, X } from "lucide-react";
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
const TV_RECENT_SEARCHES_KEY = "iptv:v1:tv-recent-movie-searches";
const DEFAULT_MOVIES_PAGE_SIZE = 24;
const CONTINUE_PAGE_SIZE = 6;
const MOVIES_GRID_MAX_PAGE_SIZE = 60;
const TV_SEARCH_RECENT_LIMIT = 8;
const TV_KEYBOARD_ROWS = [
  ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"],
  ["K", "L", "M", "N", "O", "P", "Q", "R", "S", "T"],
  ["U", "V", "W", "X", "Y", "Z", "0", "1", "2", "3"],
  ["4", "5", "6", "7", "8", "9", "-", "&", "'", "."],
];

async function exitMovieFullscreen() {
  if (typeof document === "undefined") return false;
  if (document.exitFullscreen) {
    await document.exitFullscreen();
    return true;
  }
  if (document.webkitExitFullscreen) {
    document.webkitExitFullscreen();
    return true;
  }
  if (document.mozCancelFullScreen) {
    document.mozCancelFullScreen();
    return true;
  }
  if (document.msExitFullscreen) {
    document.msExitFullscreen();
    return true;
  }
  return false;
}

function text(value) {
  return String(value || "").trim();
}

function normalizeRecentSearches(list) {
  const seen = new Set();
  const out = [];
  for (const item of Array.isArray(list) ? list : []) {
    const value = text(item);
    const key = value.toLowerCase();
    if (!value || seen.has(key)) continue;
    seen.add(key);
    out.push(value);
    if (out.length >= TV_SEARCH_RECENT_LIMIT) break;
  }
  return out;
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

function uniqueMoviesById(list, limit = 12) {
  const seen = new Set();
  const out = [];
  for (const movie of Array.isArray(list) ? list : []) {
    const key = String(movie?.id || "").trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(movie);
    if (out.length >= limit) break;
  }
  return out;
}

function mergeMoviePatch(movie, patch = {}) {
  const nextProgress = patch.progress
    ? {
        ...(movie?.progress || {}),
        ...(patch.progress || {}),
        updatedAt: String(patch?.progress?.updatedAt || movie?.progress?.updatedAt || new Date().toISOString()),
      }
    : movie?.progress;

  return {
    ...movie,
    ...(patch || {}),
    progress: nextProgress,
    watchState: nextProgress ? deriveWatchState(nextProgress) : movie?.watchState,
  };
}

function sortContinueItems(list) {
  return (Array.isArray(list) ? list : [])
    .filter((movie) => movie?.watchState === "continue")
    .toSorted((a, b) => new Date(b?.progress?.updatedAt || 0).getTime() - new Date(a?.progress?.updatedAt || 0).getTime());
}

function upsertContinueItems(list, movie) {
  const nextList = Array.isArray(list) ? [...list] : [];
  const movieId = String(movie?.id || "").trim();
  if (!movieId) return sortContinueItems(nextList);

  const withoutMovie = nextList.filter((row) => String(row?.id || "").trim() !== movieId);
  if (movie?.watchState !== "continue") {
    return sortContinueItems(withoutMovie);
  }

  return sortContinueItems([movie, ...withoutMovie]);
}

function hasPoster(movie) {
  return Boolean(text(movie?.posterUrl));
}

function canUseHeroPoster(movie) {
  const posterUrl = text(movie?.posterUrl);
  const title = text(movie?.title).toLowerCase();
  if (!posterUrl) return false;
  if (posterUrl.startsWith("data:")) return false;
  if (posterUrl.includes("/placeholder") || posterUrl.includes("placeholder.")) return false;
  if (title === "untitled") return false;
  return true;
}

function preloadImage(src) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image.naturalWidth >= 180 && image.naturalHeight >= 260);
    image.onerror = () => resolve(false);
    image.src = src;
  });
}

function selectHeroMovies(list, limit = 10) {
  const source = Array.isArray(list) ? list : [];
  const eligible = source
    .filter((movie) => canUseHeroPoster(movie) && Number(movie?.imdbRating || 0) >= 6)
    .toSorted((a, b) => {
      const ratingDiff = Number(b?.imdbRating || 0) - Number(a?.imdbRating || 0);
      if (ratingDiff !== 0) return ratingDiff;
      return Number(b?.imdbVotes || 0) - Number(a?.imdbVotes || 0);
    })
    .slice(0, Math.max(limit * 4, 40));

  if (!eligible.length) return [];

  const byCategory = new Map();
  for (const movie of eligible) {
    const categoryKey =
      String(movie?.categorySlugs?.[0] || movie?.categories?.[0]?.slug || movie?.categories?.[0]?.name || "other").trim().toLowerCase() ||
      "other";
    const bucket = byCategory.get(categoryKey) || [];
    bucket.push(movie);
    byCategory.set(categoryKey, bucket);
  }

  const buckets = Array.from(byCategory.values()).map((bucket) => {
    const shuffled = [...bucket];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  });

  buckets.sort((a, b) => Number(b?.[0]?.imdbRating || 0) - Number(a?.[0]?.imdbRating || 0));

  const picked = [];
  while (buckets.length && picked.length < limit) {
    for (let index = 0; index < buckets.length && picked.length < limit; index += 1) {
      const movie = buckets[index].shift();
      if (movie) picked.push(movie);
    }
    for (let index = buckets.length - 1; index >= 0; index -= 1) {
      if (!buckets[index].length) buckets.splice(index, 1);
    }
  }

  return picked;
}

export default function MoviesView({
  variant = "browse",
  isTvMode = false,
  externalFilterResetToken = 0,
  initialMovies = [],
  movieCategories = [],
  initialContinueWatching = [],
  initialPage = 1,
  initialPageSize = DEFAULT_MOVIES_PAGE_SIZE,
  totalMovies = 0,
  totalMoviePages = 1,
  isPageLoading = false,
  searchValue = "",
  onSearchChange,
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
  const [continueItems, setContinueItems] = useState(() =>
    Array.isArray(initialContinueWatching) ? initialContinueWatching : []
  );
  const [searchDraft, setSearchDraft] = useState(() => String(searchValue || ""));
  const [moviesPage, setMoviesPage] = useState(() => Math.max(1, Number(initialPage || 1)));
  const [moviesPageSize, setMoviesPageSize] = useState(() => Math.max(1, Number(initialPageSize || DEFAULT_MOVIES_PAGE_SIZE)));
  const [continuePage, setContinuePage] = useState(1);
  const [isTouchContinueUi, setIsTouchContinueUi] = useState(false);
  const [isMobileFilterUi, setIsMobileFilterUi] = useState(false);
  const [isMobilePortraitUi, setIsMobilePortraitUi] = useState(false);
  const [isDocumentFullscreen, setIsDocumentFullscreen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [desktopSearchOpen, setDesktopSearchOpen] = useState(false);
  const [desktopSearchClosing, setDesktopSearchClosing] = useState(false);
  const [desktopSearchOrigin, setDesktopSearchOrigin] = useState({ x: 0, y: 0 });
  const [tvSearchOpen, setTvSearchOpen] = useState(false);
  const [tvFilterOpen, setTvFilterOpen] = useState(false);
  const [tvRecentSearches, setTvRecentSearches] = useState([]);
  const [tvWatchPlaybackOpen, setTvWatchPlaybackOpen] = useState(false);
  const [mobileEdgeBottom, setMobileEdgeBottom] = useState(88);
  const [heroMovies, setHeroMovies] = useState([]);
  const [heroIndex, setHeroIndex] = useState(0);
  const heroSectionRef = useRef(null);
  const moviesSectionRef = useRef(null);
  const watchPlayerColRef = useRef(null);
  const tvSearchInputRef = useRef(null);
  const desktopSearchInputRef = useRef(null);
  const desktopSearchTriggerRef = useRef(null);
  const desktopSearchCloseTimerRef = useRef(0);
  const heroTouchStartXRef = useRef(0);
  const heroTouchStartYRef = useRef(0);
  const tvSearchTriggerFocusIdRef = useRef("movie-tv-open-search");
  const tvFilterTriggerFocusIdRef = useRef("movie-tv-open-filters");
  const hasFilterScrollMountedRef = useRef(false);
  const pendingPageScrollRef = useRef(false);
  const initialBrowseHeroScrollDoneRef = useRef(false);
  const [categorySlug, setCategorySlug] = useState("all");
  const [selectedMovieId, setSelectedMovieId] = useState(() => {
    const normalizedSelectedSlug = text(initialSelectedMovieSlug).toLowerCase();
    const preferredBySlug =
      (Array.isArray(initialMovies) ? initialMovies : []).find(
        (movie) => text(movie?.slug).toLowerCase() === normalizedSelectedSlug
      ) ||
      (Array.isArray(initialContinueWatching) ? initialContinueWatching : []).find(
        (movie) => text(movie?.slug).toLowerCase() === normalizedSelectedSlug
      ) ||
      null;
    if (preferredBySlug?.id) return String(preferredBySlug.id);
    const preferred = Array.isArray(initialContinueWatching) && initialContinueWatching.length ? initialContinueWatching[0] : null;
    if (preferred?.id) return String(preferred.id);
    const first = Array.isArray(initialMovies) && initialMovies.length ? initialMovies[0] : null;
    return String(first?.id || "");
  });
  const [playerStartFrom, setPlayerStartFrom] = useState(null);
  const [playerReplayToken, setPlayerReplayToken] = useState(0);
  const selectedMovieSlug = text(initialSelectedMovieSlug).toLowerCase();

  const captureDesktopSearchOrigin = useCallback(() => {
    if (typeof window === "undefined") return { x: 0, y: 0 };
    const trigger = desktopSearchTriggerRef.current;
    if (!(trigger instanceof HTMLElement)) {
      return { x: window.innerWidth - 56, y: Math.round(window.innerHeight * 0.5) };
    }
    const rect = trigger.getBoundingClientRect();
    return {
      x: Math.round(rect.left + rect.width / 2),
      y: Math.round(rect.top + rect.height / 2),
    };
  }, []);

  const closeDesktopSearch = useCallback(() => {
    if (!desktopSearchOpen || desktopSearchClosing) return;
    if (typeof window === "undefined") {
      setDesktopSearchOpen(false);
      setDesktopSearchClosing(false);
      return;
    }
    window.clearTimeout(desktopSearchCloseTimerRef.current);
    setDesktopSearchClosing(true);
    desktopSearchCloseTimerRef.current = window.setTimeout(() => {
      setDesktopSearchOpen(false);
      setDesktopSearchClosing(false);
    }, 240);
  }, [desktopSearchClosing, desktopSearchOpen]);

  const openDesktopSearch = useCallback(() => {
    const origin = captureDesktopSearchOrigin();
    setDesktopSearchOrigin(origin);
    if (typeof window !== "undefined") {
      window.clearTimeout(desktopSearchCloseTimerRef.current);
    }
    setDesktopSearchClosing(false);
    setDesktopSearchOpen(true);
  }, [captureDesktopSearchOrigin]);

  useEffect(() => {
    setMovies(Array.isArray(initialMovies) ? initialMovies : []);
  }, [initialMovies]);

  useEffect(() => {
    setContinueItems(Array.isArray(initialContinueWatching) ? initialContinueWatching : []);
  }, [initialContinueWatching]);

  useEffect(() => {
    setMoviesPage(Math.max(1, Number(initialPage || 1)));
  }, [initialPage]);

  useEffect(() => {
    setMoviesPageSize(Math.max(1, Number(initialPageSize || DEFAULT_MOVIES_PAGE_SIZE)));
  }, [initialPageSize]);

  useEffect(() => {
    setSearchDraft(String(searchValue || ""));
  }, [searchValue]);

  useEffect(() => {
    if (!selectedMovieSlug) return;
    const row =
      movies.find((movie) => text(movie?.slug).toLowerCase() === selectedMovieSlug) ||
      continueItems.find((movie) => text(movie?.slug).toLowerCase() === selectedMovieSlug) ||
      null;
    if (!row?.id) return;
    setSelectedMovieId(String(row.id));
  }, [continueItems, movies, selectedMovieSlug]);

  const selectedMovie = useMemo(() => {
    const normalizedSelectedId = String(selectedMovieId || "");
    const normalizedSelectedSlug = text(selectedMovieSlug).toLowerCase();
    return (
      movies.find((movie) => String(movie?.id || "") === normalizedSelectedId) ||
      continueItems.find((movie) => String(movie?.id || "") === normalizedSelectedId) ||
      movies.find((movie) => text(movie?.slug).toLowerCase() === normalizedSelectedSlug) ||
      continueItems.find((movie) => text(movie?.slug).toLowerCase() === normalizedSelectedSlug) ||
      null
    );
  }, [continueItems, movies, selectedMovieId, selectedMovieSlug]);

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
    const first =
      movies.find((movie) => text(movie?.slug).toLowerCase() === selectedMovieSlug) ||
      continueItems.find((movie) => text(movie?.slug).toLowerCase() === selectedMovieSlug) ||
      movies[0] ||
      continueItems[0] ||
      null;
    if (first?.id) setSelectedMovieId(String(first.id));
  }, [continueItems, movies, selectedMovie, selectedMovieSlug]);

  const focusTvElementById = useCallback((focusId) => {
    if (typeof document === "undefined") return false;
    const normalizedId = String(focusId || "").trim();
    if (!normalizedId) return false;
    const target = document.querySelector(`[data-tv-focus-id="${normalizedId}"]`);
    if (!(target instanceof HTMLElement)) return false;
    target.focus();
    return true;
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(TV_RECENT_SEARCHES_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      setTvRecentSearches(normalizeRecentSearches(parsed));
    } catch {
      // ignore malformed local storage
    }
  }, []);

  const rememberTvSearch = useCallback((query) => {
    const normalized = text(query);
    if (!normalized || typeof window === "undefined") return;
    setTvRecentSearches((prev) => {
      const next = normalizeRecentSearches([normalized, ...prev]);
      window.localStorage.setItem(TV_RECENT_SEARCHES_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const openTvSearchOverlay = useCallback((focusId = "movie-tv-open-search") => {
    tvSearchTriggerFocusIdRef.current = String(focusId || "movie-tv-open-search");
    setTvFilterOpen(false);
    setTvSearchOpen(true);
  }, []);

  const closeTvSearchOverlay = useCallback(() => {
    rememberTvSearch(searchDraft);
    setTvSearchOpen(false);
    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        focusTvElementById(tvSearchTriggerFocusIdRef.current);
      });
    }
  }, [focusTvElementById, rememberTvSearch, searchDraft]);

  const openTvFilterOverlay = useCallback((focusId = "movie-tv-open-filters") => {
    tvFilterTriggerFocusIdRef.current = String(focusId || "movie-tv-open-filters");
    setTvSearchOpen(false);
    setTvFilterOpen(true);
  }, []);

  const closeTvFilterOverlay = useCallback(() => {
    setTvFilterOpen(false);
    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        focusTvElementById(tvFilterTriggerFocusIdRef.current);
      });
    }
  }, [focusTvElementById]);

  const appendTvSearchText = useCallback((chunk) => {
    setSearchDraft((prev) => `${String(prev || "")}${String(chunk || "")}`);
  }, []);

  const backspaceTvSearchText = useCallback(() => {
    setSearchDraft((prev) => String(prev || "").slice(0, -1));
  }, []);

  const applyTvSearchSuggestion = useCallback(
    (value) => {
      const normalized = text(value);
      setSearchDraft(normalized);
      if (normalized) rememberTvSearch(normalized);
    },
    [rememberTvSearch]
  );

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

  const search = String(searchValue || "");
  const isSearchSyncing = String(searchDraft || "") !== search;
  const isSearchLoading = Boolean(String(search || "").trim()) && Boolean(isPageLoading);
  const isSearchBusy = isSearchSyncing || isSearchLoading;
  const searchPendingText = isSearchSyncing ? "Typing..." : "Searching...";
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
        includeSearch = false,
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
        return true;
      });
    },
    [normalizedCategory, normalizedGenre, normalizedLanguage, normalizedYear]
  );

  const filteredMovies = useMemo(() => {
    return applyMovieFilters(modeScopedMovies, { includeSearch: false });
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
    return sortContinueItems(continueItems).slice(0, 60);
  }, [continueItems]);

  const tvFeaturedMovie = useMemo(() => {
    return (
      selectedMovie ||
      continueWatching[0] ||
      filteredMovies[0] ||
      movies[0] ||
      null
    );
  }, [continueWatching, filteredMovies, movies, selectedMovie]);

  const topRatedMovies = useMemo(() => {
    return uniqueMoviesById(
      [...filteredMovies].sort((a, b) => Number(b?.imdbRating || 0) - Number(a?.imdbRating || 0)),
      12
    );
  }, [filteredMovies]);

  const recentReleaseMovies = useMemo(() => {
    return uniqueMoviesById(
      [...filteredMovies].sort((a, b) => Number(b?.releaseYear || 0) - Number(a?.releaseYear || 0)),
      12
    );
  }, [filteredMovies]);

  const favoriteMovies = useMemo(() => {
    return uniqueMoviesById(filteredMovies.filter((movie) => Boolean(movie?.isFavorite)), 12);
  }, [filteredMovies]);

  const heroSourceMovies = useMemo(() => {
    return uniqueMoviesById(
      [
        ...filteredMovies,
        ...continueWatching,
        ...topRatedMovies,
        ...recentReleaseMovies,
        ...favoriteMovies,
      ],
      80
    );
  }, [continueWatching, favoriteMovies, filteredMovies, recentReleaseMovies, topRatedMovies]);

  useEffect(() => {
    let cancelled = false;

    const resolveHeroMovies = async () => {
      const candidates = selectHeroMovies(heroSourceMovies, 10);
      if (!candidates.length) {
        if (!cancelled) {
          setHeroMovies([]);
          setHeroIndex(0);
        }
        return;
      }

      // Show slider controls immediately on first paint, then refine with verified posters.
      if (!cancelled) {
        setHeroMovies(candidates);
        setHeroIndex(0);
      }

      const verified = [];
      for (const movie of candidates) {
        const posterUrl = text(movie?.posterUrl);
        if (!posterUrl) continue;
        const isReady = await preloadImage(posterUrl);
        if (cancelled) return;
        if (isReady) verified.push(movie);
        if (verified.length >= 10) break;
      }

      if (!cancelled) {
        setHeroMovies(verified.length >= 2 ? verified : candidates);
        setHeroIndex(0);
      }
    };

    resolveHeroMovies();

    return () => {
      cancelled = true;
    };
  }, [heroSourceMovies]);

  useEffect(() => {
    if (heroMovies.length <= 1) return undefined;
    const timer = window.setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % heroMovies.length);
    }, 5200);
    return () => window.clearInterval(timer);
  }, [heroMovies]);

  const activeHeroMovie = heroMovies[heroIndex] || null;

  const becauseYouWatchedMovies = useMemo(() => {
    const seed = continueWatching[0] || selectedMovie || tvFeaturedMovie;
    const seedGenres = new Set(
      (Array.isArray(seed?.imdbGenres) ? seed.imdbGenres : [])
        .map((entry) => String(entry || "").trim().toLowerCase())
        .filter(Boolean)
    );
    if (!seedGenres.size) return [];
    return uniqueMoviesById(
      filteredMovies.filter((movie) => {
        if (String(movie?.id || "") === String(seed?.id || "")) return false;
        return (Array.isArray(movie?.imdbGenres) ? movie.imdbGenres : []).some((entry) =>
          seedGenres.has(String(entry || "").trim().toLowerCase())
        );
      }),
      12
    );
  }, [continueWatching, filteredMovies, selectedMovie, tvFeaturedMovie]);

  const sameLanguageMovies = useMemo(() => {
    const seed = continueWatching[0] || selectedMovie || tvFeaturedMovie;
    const languageKey = String((Array.isArray(seed?.imdbLanguages) ? seed.imdbLanguages[0] : "") || "")
      .trim()
      .toLowerCase();
    if (!languageKey) return [];
    return uniqueMoviesById(
      filteredMovies.filter((movie) => {
        if (String(movie?.id || "") === String(seed?.id || "")) return false;
        return (Array.isArray(movie?.imdbLanguages) ? movie.imdbLanguages : []).some(
          (entry) => String(entry || "").trim().toLowerCase() === languageKey
        );
      }),
      12
    );
  }, [continueWatching, filteredMovies, selectedMovie, tvFeaturedMovie]);

  const tvGenreRailSections = useMemo(() => {
    const topGenres = (Array.isArray(facetedGenreOptions) ? facetedGenreOptions : [])
      .filter((entry) => Number(entry?.count || 0) > 1)
      .sort((a, b) => Number(b?.count || 0) - Number(a?.count || 0))
      .slice(0, 4);

    return topGenres
      .map((genre) => {
        const key = String(genre?.key || "").trim().toLowerCase();
        const items = uniqueMoviesById(
          filteredMovies.filter((movie) =>
            (Array.isArray(movie?.imdbGenres) ? movie.imdbGenres : []).some(
              (entry) => String(entry || "").trim().toLowerCase() === key
            )
          ),
          12
        );
        if (!items.length) return null;
        return {
          key: `genre-${key}`,
          title: genre?.name || "Genre",
          items,
        };
      })
      .filter(Boolean);
  }, [facetedGenreOptions, filteredMovies]);

  const tvRailSections = useMemo(() => {
    const sections = [];
    if (continueWatching.length) {
      sections.push({
        key: "continue",
        title: "Continue Watching",
        items: uniqueMoviesById(continueWatching, 12),
      });
    }
    if (favoriteMovies.length) {
      sections.push({
        key: "favorites",
        title: "Your Favorites",
        items: favoriteMovies,
      });
    }
    if (becauseYouWatchedMovies.length) {
      sections.push({
        key: "because-you-watched",
        title: "Because You Watched This",
        items: becauseYouWatchedMovies,
      });
    }
    if (sameLanguageMovies.length) {
      sections.push({
        key: "same-language",
        title: "More In This Language",
        items: sameLanguageMovies,
      });
    }
    if (topRatedMovies.length) {
      sections.push({
        key: "top-rated",
        title: "Top Rated",
        items: topRatedMovies,
      });
    }
    if (recentReleaseMovies.length) {
      sections.push({
        key: "recent-release",
        title: "Recent Releases",
        items: recentReleaseMovies,
      });
    }
    for (const rail of tvGenreRailSections) {
      sections.push(rail);
    }
    if (!sections.length && filteredMovies.length) {
      sections.push({
        key: "all-movies",
        title: "Browse Movies",
        items: uniqueMoviesById(filteredMovies, 12),
      });
    }
    return sections;
  }, [
    becauseYouWatchedMovies,
    continueWatching,
    favoriteMovies,
    filteredMovies,
    recentReleaseMovies,
    sameLanguageMovies,
    topRatedMovies,
    tvGenreRailSections,
  ]);

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

  const hasLocalClientFilters =
    showInlineFilters ? String(categorySlug || "").trim().toLowerCase() !== "all" : false;
  const totalFilteredMovies = hasLocalClientFilters ? filteredMovies.length : Number(totalMovies || filteredMovies.length);
  const totalPages = hasLocalClientFilters
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
    if (!hasLocalClientFilters) return filteredMovies;
    const start = (currentPage - 1) * moviesPageSize;
    return filteredMovies.slice(start, start + moviesPageSize);
  }, [filteredMovies, currentPage, hasLocalClientFilters, moviesPageSize]);

  useEffect(() => {
    setMoviesPage(1);
  }, [searchValue, filterMode, filterCategorySlug, filterGenreSlug, filterLanguageSlug, filterYear, categorySlug, showInlineFilters]);

  useEffect(() => {
    const normalizedDraft = String(searchDraft || "");
    const normalizedValue = String(searchValue || "");
    if (normalizedDraft === normalizedValue) return undefined;
    const timer = window.setTimeout(() => {
      onSearchChange?.(normalizedDraft);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [onSearchChange, searchDraft, searchValue]);

  const goToMoviePage = useCallback(
    (page) => {
      const targetPage = Math.min(Math.max(1, Number(page || 1)), totalPages);
      setMoviesPage(targetPage);
      pendingPageScrollRef.current = true;
      if (variant === "browse" && !hasLocalClientFilters && targetPage !== currentPage) {
        onPageChange?.(targetPage, moviesPageSize);
      }
    },
    [currentPage, hasLocalClientFilters, moviesPageSize, onPageChange, totalPages, variant]
  );

  useEffect(() => {
    if (moviesPage > totalPages) setMoviesPage(totalPages);
  }, [moviesPage, totalPages]);

  useEffect(() => {
    if (continuePage > totalContinuePages) setContinuePage(totalContinuePages);
  }, [continuePage, totalContinuePages]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const media = window.matchMedia("(max-width: 640px), (hover: none) and (pointer: coarse)");
    const portraitMedia = window.matchMedia("(orientation: portrait)");
    const sync = () => {
      const matched = Boolean(media.matches);
      setIsTouchContinueUi(matched);
      setIsMobileFilterUi(matched);
      setIsMobilePortraitUi(matched && Boolean(portraitMedia.matches));
    };
    sync();
    media.addEventListener?.("change", sync);
    portraitMedia.addEventListener?.("change", sync);
    return () => {
      media.removeEventListener?.("change", sync);
      portraitMedia.removeEventListener?.("change", sync);
    };
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const sync = () => {
      setIsDocumentFullscreen(Boolean(document.fullscreenElement || document.webkitFullscreenElement));
    };
    sync();
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("webkitfullscreenchange", sync);
    };
  }, []);

  useEffect(() => {
    if (!isMobileFilterUi) {
      setMobileSearchOpen(false);
      setMobileFilterOpen(false);
    }
  }, [isMobileFilterUi]);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    if (!mobileSearchOpen && !mobileFilterOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileFilterOpen, mobileSearchOpen]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    if (!isMobilePortraitUi || isDocumentFullscreen) return undefined;

    const syncBounds = () => {
      const viewportHeight = window.innerHeight || 0;
      const preferredBottomGap = Math.round(viewportHeight * 0.2);
      setMobileEdgeBottom(Math.max(88, preferredBottomGap));
    };

    syncBounds();
    window.addEventListener("resize", syncBounds);
    return () => {
      window.removeEventListener("resize", syncBounds);
    };
  }, [isDocumentFullscreen, isMobilePortraitUi, variant]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (variant !== "watch") return;
    if (isTvMode && !tvWatchPlaybackOpen) {
      let rafId = 0;
      let timerId = 0;
      const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
      };
      rafId = window.requestAnimationFrame(() => {
        scrollToTop();
        timerId = window.setTimeout(scrollToTop, 140);
      });
      return () => {
        window.cancelAnimationFrame(rafId);
        window.clearTimeout(timerId);
      };
    }
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
  }, [variant, selectedMovieId, isTvMode, tvWatchPlaybackOpen]);

  useEffect(() => {
    setMoviesPage(1);
    if (showInlineFilters) setCategorySlug("all");
  }, [externalFilterResetToken, showInlineFilters]);

  useEffect(() => {
    if (!hasFilterScrollMountedRef.current) {
      hasFilterScrollMountedRef.current = true;
      return;
    }
    if (isMobileFilterUi) return;
    scrollToMoviesSection();
  }, [
    filterMode,
    filterCategorySlug,
    filterGenreSlug,
    filterLanguageSlug,
    filterYear,
    categorySlug,
    isMobileFilterUi,
    showInlineFilters,
    scrollToMoviesSection,
  ]);

  useEffect(() => {
    if (!pendingPageScrollRef.current) return;
    if (isMobileFilterUi) {
      pendingPageScrollRef.current = false;
      return;
    }
    if (isPageLoading) return;
    pendingPageScrollRef.current = false;
    scrollToMoviesSection("smooth");
  }, [currentPage, isMobileFilterUi, isPageLoading, pagedMovies.length, scrollToMoviesSection]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    if (variant !== "browse" || isTvMode) return undefined;
    if (!activeHeroMovie) return undefined;
    if (initialBrowseHeroScrollDoneRef.current) return undefined;
    initialBrowseHeroScrollDoneRef.current = true;

    const previousRestoration =
      typeof window.history?.scrollRestoration === "string" ? window.history.scrollRestoration : "";
    if (typeof window.history?.scrollRestoration === "string") {
      window.history.scrollRestoration = "manual";
    }

    let rafId = 0;
    let timerA = 0;
    let timerB = 0;

    const snapToHeroTop = () => {
      const heroNode = heroSectionRef.current;
      if (heroNode && typeof heroNode.scrollIntoView === "function") {
        heroNode.scrollIntoView({ block: "start", inline: "nearest", behavior: "auto" });
      }
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    };

    rafId = window.requestAnimationFrame(() => {
      snapToHeroTop();
      timerA = window.setTimeout(snapToHeroTop, 120);
      timerB = window.setTimeout(snapToHeroTop, 300);
    });

    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(timerA);
      window.clearTimeout(timerB);
      if (typeof window.history?.scrollRestoration === "string") {
        window.history.scrollRestoration = previousRestoration || "auto";
      }
    };
  }, [activeHeroMovie, isTvMode, variant]);

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

  const clearFilterTag = useCallback(
    (tagKey) => {
      if (tagKey === "search") {
        setSearchDraft("");
        onSearchChange?.("");
      }
      if (tagKey === "inline_category") setCategorySlug("all");
      if (tagKey === "category") onSelectCategoryFilter?.("");
      if (tagKey === "genre") onSelectGenreFilter?.("");
      if (tagKey === "language") onSelectLanguageFilter?.("");
      if (tagKey === "year") onSelectYearFilter?.("");
      if (tagKey === "mode") onSelectModeFilter?.("all");
    },
    [
      onSearchChange,
      onSelectCategoryFilter,
      onSelectGenreFilter,
      onSelectLanguageFilter,
      onSelectModeFilter,
      onSelectYearFilter,
    ]
  );

  const clearAllFilters = useCallback(() => {
    setSearchDraft("");
    onSearchChange?.("");
    if (showInlineFilters) setCategorySlug("all");
    onResetFilters?.();
  }, [onResetFilters, onSearchChange, showInlineFilters]);

  const clearSearchOnly = useCallback(() => {
    setSearchDraft("");
    onSearchChange?.("");
    if (!showInlineFilters) onSelectModeFilter?.("all");
  }, [onSearchChange, onSelectModeFilter, showInlineFilters]);

  const mobileSearchResults = useMemo(() => {
    const query = String(searchDraft || "").trim().toLowerCase();
    const baseList = applyMovieFilters(modeScopedMovies, { includeSearch: false });
    const matched = query
      ? baseList.filter((movie) => {
          const haystack = [
            movie?.title,
            movie?.synopsis,
            ...(Array.isArray(movie?.imdbGenres) ? movie.imdbGenres : []),
            ...(Array.isArray(movie?.imdbDirectors) ? movie.imdbDirectors : []),
            ...(Array.isArray(movie?.imdbWriters) ? movie.imdbWriters : []),
            ...(Array.isArray(movie?.imdbStars) ? movie.imdbStars : []),
            ...(Array.isArray(movie?.imdbCountries) ? movie.imdbCountries : []),
            ...(Array.isArray(movie?.imdbLanguages) ? movie.imdbLanguages : []),
            movie?.imdbId,
          ]
            .map((value) => text(value).toLowerCase())
            .join(" ");
          return haystack.includes(query);
        })
      : baseList;

    return matched.slice(0, 10);
  }, [applyMovieFilters, modeScopedMovies, searchDraft]);

  const tvSearchResults = useMemo(() => {
    if (String(searchDraft || "").trim()) return mobileSearchResults;
    return uniqueMoviesById(
      [...continueWatching, ...favoriteMovies, ...topRatedMovies, ...recentReleaseMovies, ...filteredMovies],
      14
    );
  }, [continueWatching, favoriteMovies, filteredMovies, mobileSearchResults, recentReleaseMovies, searchDraft, topRatedMovies]);

  const tvQuerySuggestions = useMemo(() => {
    const query = String(searchDraft || "").trim().toLowerCase();
    const pool = [
      ...tvRecentSearches,
      ...facetedGenreOptions.slice(0, 10).map((entry) => entry?.name),
      ...facetedLanguageOptions.slice(0, 8).map((entry) => entry?.name),
      ...categoriesWithCount.slice(0, 8).map((entry) => entry?.name),
      ...facetedYearOptions.slice(0, 6).map((entry) => entry?.name),
      ...favoriteMovies.slice(0, 6).map((movie) => movie?.title),
    ];
    const normalizedPool = normalizeRecentSearches(pool);
    if (!query) return normalizedPool.slice(0, 12);
    return normalizedPool.filter((value) => value.toLowerCase().includes(query)).slice(0, 12);
  }, [
    categoriesWithCount,
    facetedGenreOptions,
    facetedLanguageOptions,
    facetedYearOptions,
    favoriteMovies,
    searchDraft,
    tvRecentSearches,
  ]);

  const searchControls = (
    <div className={styles.searchRow}>
      <div className={styles.searchInputWrap}>
        <input
          value={searchDraft}
          onChange={(event) => setSearchDraft(event.target.value)}
          placeholder="Search movies or genre:horror"
          className={`${styles.searchInput} ${styles.searchInputCentered}`}
          data-tv-focusable={isTvMode ? "true" : undefined}
          data-tv-focus-scope={isTvMode ? "movie-content" : undefined}
          data-tv-focus-id={isTvMode ? "movie-search-input" : undefined}
        />
        {isSearchBusy ? (
          <span className={styles.searchStatusBadge}>
            {searchPendingText}
          </span>
        ) : null}
      </div>
    </div>
  );

  const filterControls = (
    <>
      <div className={styles.filters}>
        {showInlineFilters ? (
          <>
            <button
              type="button"
              className={`${styles.filterBtn} ${categorySlug === "all" ? styles.filterBtnActive : ""}`}
              onClick={() => setCategorySlug("all")}
              data-tv-focusable={isTvMode ? "true" : undefined}
              data-tv-focus-scope={isTvMode ? "movie-content" : undefined}
              data-tv-focus-id={isTvMode ? "movie-filter-category-all" : undefined}
              data-tv-active={isTvMode && categorySlug === "all" ? "true" : undefined}
            >
              All ({movies.length})
            </button>
            {categoriesWithCount.map((category) => (
              <button
                type="button"
                key={category.slug || category.id}
                className={`${styles.filterBtn} ${categorySlug === category.slug ? styles.filterBtnActive : ""}`}
                onClick={() => setCategorySlug(category.slug)}
                data-tv-focusable={isTvMode ? "true" : undefined}
                data-tv-focus-scope={isTvMode ? "movie-content" : undefined}
                data-tv-focus-id={isTvMode ? `movie-filter-category-${String(category.slug || category.id || "")}` : undefined}
                data-tv-active={isTvMode && categorySlug === category.slug ? "true" : undefined}
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
                data-tv-focusable={isTvMode ? "true" : undefined}
                data-tv-focus-scope={isTvMode ? "movie-content" : undefined}
                data-tv-focus-id={isTvMode ? "movie-filter-genre-all" : undefined}
                data-tv-active={isTvMode && !filterGenreSlug ? "true" : undefined}
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
                    data-tv-focusable={isTvMode ? "true" : undefined}
                    data-tv-focus-scope={isTvMode ? "movie-content" : undefined}
                    data-tv-focus-id={isTvMode ? `movie-filter-genre-${key}` : undefined}
                    data-tv-active={isTvMode && key && key === String(filterGenreSlug || "").trim().toLowerCase() ? "true" : undefined}
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
                data-tv-focusable={isTvMode ? "true" : undefined}
                data-tv-focus-scope={isTvMode ? "movie-content" : undefined}
                data-tv-focus-id={isTvMode ? "movie-filter-language-all" : undefined}
                data-tv-active={isTvMode && !filterLanguageSlug ? "true" : undefined}
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
                    data-tv-focusable={isTvMode ? "true" : undefined}
                    data-tv-focus-scope={isTvMode ? "movie-content" : undefined}
                    data-tv-focus-id={isTvMode ? `movie-filter-language-${key}` : undefined}
                    data-tv-active={isTvMode && key && key === String(filterLanguageSlug || "").trim().toLowerCase() ? "true" : undefined}
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
                data-tv-focusable={isTvMode ? "true" : undefined}
                data-tv-focus-scope={isTvMode ? "movie-content" : undefined}
                data-tv-focus-id={isTvMode ? "movie-filter-year-all" : undefined}
                data-tv-active={isTvMode && !filterYear ? "true" : undefined}
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
                    data-tv-focusable={isTvMode ? "true" : undefined}
                    data-tv-focus-scope={isTvMode ? "movie-content" : undefined}
                    data-tv-focus-id={isTvMode ? `movie-filter-year-${key}` : undefined}
                    data-tv-active={isTvMode && key && key === String(filterYear || "").trim() ? "true" : undefined}
                  >
                    {yearRow?.name} ({Number(yearRow?.count || 0)})
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );

  const activeFilterControls = !showInlineFilters ? (
    <div className={styles.activeFilterWrap}>
      <strong className={styles.activeFilterTitle}>Active Filters</strong>
      <div className={styles.activeFilterChips}>
        {activeFilterTags.length ? (
          activeFilterTags.map((tag) => (
            <button
              type="button"
              key={tag.key}
              className={styles.activeFilterChip}
              onClick={() => clearFilterTag(tag.key)}
              title="Clear this filter"
              data-tv-focusable={isTvMode ? "true" : undefined}
              data-tv-focus-scope={isTvMode ? "movie-content" : undefined}
              data-tv-focus-id={isTvMode ? `movie-active-filter-${tag.key}` : undefined}
            >
              {tag.label} ×
            </button>
          ))
        ) : (
          <span className={styles.activeFilterChip}>All Movies</span>
        )}
        {activeFilterTags.length ? (
          <button
            type="button"
            className={styles.clearAllBtn}
            onClick={clearAllFilters}
            data-tv-focusable={isTvMode ? "true" : undefined}
            data-tv-focus-scope={isTvMode ? "movie-content" : undefined}
            data-tv-focus-id={isTvMode ? "movie-clear-all-filters" : undefined}
          >
            Clear All Filters
          </button>
        ) : null}
      </div>
    </div>
  ) : null;

  const tvSearchOverlay = isTvMode ? (
    <>
      <button
        type="button"
        aria-label="Close TV search overlay"
        className={`${styles.tvSearchOverlayBackdrop} ${tvSearchOpen ? styles.tvSearchOverlayBackdropOpen : ""}`}
        onClick={closeTvSearchOverlay}
        hidden={!tvSearchOpen}
      />
      <aside
        className={`${styles.tvSearchOverlay} ${tvSearchOpen ? styles.tvSearchOverlayOpen : ""}`}
        aria-hidden={!tvSearchOpen}
      >
        <header className={styles.tvSearchOverlayHead}>
          <div>
            <div className={styles.tvHeroEyebrow}>TV Search</div>
            <h3 className={styles.tvSearchOverlayTitle}>Find a movie fast</h3>
          </div>
          <div className={styles.tvSearchOverlayActions}>
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={clearSearchOnly}
              data-tv-focusable="true"
              data-tv-focus-scope="movie-search-overlay"
              data-tv-focus-id="movie-tv-search-clear"
            >
              Clear Search
            </button>
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={closeTvSearchOverlay}
              data-tv-focusable="true"
              data-tv-focus-scope="movie-search-overlay"
              data-tv-focus-id="movie-tv-search-close"
            >
              Close
            </button>
          </div>
        </header>

        <div className={styles.tvSearchOverlayBody}>
          <div className={styles.tvSearchInputShell}>
            <Search size={24} strokeWidth={2.1} className={styles.tvSearchInputIcon} />
            <input
              ref={tvSearchInputRef}
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  closeTvSearchOverlay();
                }
              }}
              placeholder="Search by title, genre, actor, language"
              className={styles.tvSearchInput}
              data-tv-focusable="true"
              data-tv-focus-scope="movie-search-overlay"
              data-tv-focus-id="movie-tv-search-input"
              data-tv-default-focus="true"
            />
          </div>

          <div className={styles.tvSearchMetaRow}>
            <span className={styles.sectionHint}>
              {String(searchDraft || "").trim()
                ? `${tvSearchResults.length} result${tvSearchResults.length === 1 ? "" : "s"}`
                : "Suggested movies"}
            </span>
            {activeFilterTags.length ? (
              <span className={styles.sectionHint}>
                {activeFilterTags.length} active filter{activeFilterTags.length === 1 ? "" : "s"}
              </span>
            ) : null}
          </div>

          {tvRecentSearches.length ? (
            <section className={styles.tvSearchSuggestSection}>
              <header className={styles.tvSearchSuggestHead}>
                <strong>Recent Searches</strong>
              </header>
              <div className={styles.tvSearchSuggestChips}>
                {tvRecentSearches.map((item, index) => (
                  <button
                    key={`tv-recent-search-${item}`}
                    type="button"
                    className={styles.filterBtn}
                    onClick={() => applyTvSearchSuggestion(item)}
                    data-tv-focusable="true"
                    data-tv-focus-scope="movie-search-overlay"
                    data-tv-focus-id={`movie-tv-recent-search-${index}`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          <section className={styles.tvSearchSuggestSection}>
            <header className={styles.tvSearchSuggestHead}>
              <strong>{String(searchDraft || "").trim() ? "Suggestions" : "Browse Suggestions"}</strong>
            </header>
            <div className={styles.tvSearchSuggestChips}>
              {tvQuerySuggestions.length ? (
                tvQuerySuggestions.map((item, index) => (
                  <button
                    key={`tv-suggestion-${item}`}
                    type="button"
                    className={styles.filterBtn}
                    onClick={() => applyTvSearchSuggestion(item)}
                    data-tv-focusable="true"
                    data-tv-focus-scope="movie-search-overlay"
                    data-tv-focus-id={`movie-tv-search-suggestion-${index}`}
                  >
                    {item}
                  </button>
                ))
              ) : (
                <span className={styles.activeFilterChip}>No suggestions yet</span>
              )}
            </div>
          </section>

          <section className={styles.tvSearchSuggestSection}>
            <header className={styles.tvSearchSuggestHead}>
              <strong>On-Screen Keyboard</strong>
            </header>
            <div className={styles.tvKeyboardGrid}>
              {TV_KEYBOARD_ROWS.flatMap((row, rowIndex) =>
                row.map((keyValue, keyIndex) => (
                  <button
                    key={`tv-key-${rowIndex}-${keyValue}`}
                    type="button"
                    className={styles.tvKeyboardKey}
                    onClick={() => appendTvSearchText(keyValue)}
                    data-tv-focusable="true"
                    data-tv-focus-scope="movie-search-overlay"
                    data-tv-focus-id={`movie-tv-key-${rowIndex}-${keyIndex}`}
                  >
                    {keyValue}
                  </button>
                ))
              )}
              <button
                type="button"
                className={`${styles.tvKeyboardKey} ${styles.tvKeyboardKeyWide}`}
                onClick={() => appendTvSearchText(" ")}
                data-tv-focusable="true"
                data-tv-focus-scope="movie-search-overlay"
                data-tv-focus-id="movie-tv-key-space"
              >
                Space
              </button>
              <button
                type="button"
                className={`${styles.tvKeyboardKey} ${styles.tvKeyboardKeyAction}`}
                onClick={backspaceTvSearchText}
                data-tv-focusable="true"
                data-tv-focus-scope="movie-search-overlay"
                data-tv-focus-id="movie-tv-key-backspace"
              >
                Backspace
              </button>
              <button
                type="button"
                className={`${styles.tvKeyboardKey} ${styles.tvKeyboardKeyAction}`}
                onClick={closeTvSearchOverlay}
                data-tv-focusable="true"
                data-tv-focus-scope="movie-search-overlay"
                data-tv-focus-id="movie-tv-key-close"
              >
                Close
              </button>
            </div>
          </section>

          <div className={styles.tvSearchResultsList}>
            {tvSearchResults.length ? (
              tvSearchResults.map((movie) => (
                <button
                  key={`tv-search-${String(movie?.id || movie?.slug || "")}`}
                  type="button"
                  className={styles.tvSearchResultItem}
                  onClick={() => {
                    rememberTvSearch(searchDraft || movie?.title);
                    handleSelectMovie(movie);
                    closeTvSearchOverlay();
                  }}
                  data-tv-focusable="true"
                  data-tv-focus-scope="movie-search-overlay"
                  data-tv-focus-id={`movie-tv-search-result-${String(movie?.id || movie?.slug || "")}`}
                >
                  <div className={styles.tvSearchResultPosterWrap}>
                    {movie?.posterUrl || movie?.backdropUrl ? (
                      <img
                        src={movie?.posterUrl || movie?.backdropUrl}
                        alt=""
                        className={styles.tvSearchResultPoster}
                      />
                    ) : (
                      <span className={styles.tvSearchResultPosterFallback}>No Poster</span>
                    )}
                  </div>
                  <span className={styles.tvSearchResultText}>
                    <strong>{movie?.title || "Untitled"}</strong>
                    <span>
                      {movie?.releaseYear || "Year unknown"}
                      {movie?.imdbRating ? ` | IMDb ${movie.imdbRating}` : ""}
                      {Array.isArray(movie?.imdbGenres) && movie.imdbGenres.length
                        ? ` | ${movie.imdbGenres.slice(0, 2).join(", ")}`
                        : ""}
                    </span>
                  </span>
                </button>
              ))
            ) : isSearchBusy ? (
              <div className={styles.tvSearchLoadingState}>
                <span className={styles.loadingSpinner} aria-hidden="true" />
                <p className={styles.empty}>{searchPendingText}</p>
              </div>
            ) : (
              <div className={styles.tvSearchEmptyState}>
                <p className={styles.empty}>No movies matched this search.</p>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={clearSearchOnly}
                  data-tv-focusable="true"
                  data-tv-focus-scope="movie-search-overlay"
                  data-tv-focus-id="movie-tv-search-empty-clear"
                >
                  Reset Search
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  ) : null;

  const tvFilterOverlay = isTvMode ? (
    <>
      <button
        type="button"
        aria-label="Close TV filter overlay"
        className={`${styles.tvSearchOverlayBackdrop} ${tvFilterOpen ? styles.tvSearchOverlayBackdropOpen : ""}`}
        onClick={closeTvFilterOverlay}
        hidden={!tvFilterOpen}
      />
      <aside
        className={`${styles.tvSearchOverlay} ${styles.tvFilterOverlay} ${tvFilterOpen ? styles.tvSearchOverlayOpen : ""}`}
        aria-hidden={!tvFilterOpen}
      >
        <header className={styles.tvSearchOverlayHead}>
          <div>
            <div className={styles.tvHeroEyebrow}>TV Filters</div>
            <h3 className={styles.tvSearchOverlayTitle}>Refine your browse</h3>
          </div>
          <div className={styles.tvSearchOverlayActions}>
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={clearAllFilters}
              data-tv-focusable="true"
              data-tv-focus-scope="movie-filter-overlay"
              data-tv-focus-id="movie-tv-filter-clear-all"
              data-tv-default-focus="true"
            >
              Clear All
            </button>
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={closeTvFilterOverlay}
              data-tv-focusable="true"
              data-tv-focus-scope="movie-filter-overlay"
              data-tv-focus-id="movie-tv-filter-close"
            >
              Close
            </button>
          </div>
        </header>

        <div className={`${styles.tvSearchOverlayBody} ${styles.tvFilterOverlayBody}`}>
          {!showInlineFilters ? (
            <section className={styles.tvFilterSection}>
              <header className={styles.tvFilterSectionHead}>
                <strong>Mode</strong>
              </header>
              <div className={styles.tvFilterSectionBody}>
                {[
                  ["all", "All Movies"],
                  ["favorites", "Favorites"],
                  ["recent", "Continue / Recent"],
                  ["watched", "Watched"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={`${styles.filterBtn} ${normalizedMode === value ? styles.filterBtnActive : ""}`}
                    onClick={() => onSelectModeFilter?.(value)}
                    data-tv-focusable="true"
                    data-tv-focus-scope="movie-filter-overlay"
                    data-tv-focus-id={`movie-tv-filter-mode-${value}`}
                    data-tv-active={normalizedMode === value ? "true" : undefined}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          <section className={styles.tvFilterSection}>
            <header className={styles.tvFilterSectionHead}>
              <strong>Category</strong>
            </header>
            <div className={styles.tvFilterSectionBody}>
              {showInlineFilters ? (
                <>
                  <button
                    type="button"
                    className={`${styles.filterBtn} ${categorySlug === "all" ? styles.filterBtnActive : ""}`}
                    onClick={() => setCategorySlug("all")}
                    data-tv-focusable="true"
                    data-tv-focus-scope="movie-filter-overlay"
                    data-tv-focus-id="movie-tv-filter-category-all"
                    data-tv-active={categorySlug === "all" ? "true" : undefined}
                  >
                    All
                  </button>
                  {categoriesWithCount.map((category) => (
                    <button
                      key={String(category.slug || category.id || "")}
                      type="button"
                      className={`${styles.filterBtn} ${categorySlug === category.slug ? styles.filterBtnActive : ""}`}
                      onClick={() => setCategorySlug(category.slug)}
                      data-tv-focusable="true"
                      data-tv-focus-scope="movie-filter-overlay"
                      data-tv-focus-id={`movie-tv-filter-category-${String(category.slug || category.id || "")}`}
                      data-tv-active={categorySlug === category.slug ? "true" : undefined}
                    >
                      {category.name} ({category.count})
                    </button>
                  ))}
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className={`${styles.filterBtn} ${!filterCategorySlug ? styles.filterBtnActive : ""}`}
                    onClick={() => onSelectCategoryFilter?.("")}
                    data-tv-focusable="true"
                    data-tv-focus-scope="movie-filter-overlay"
                    data-tv-focus-id="movie-tv-filter-category-global-all"
                    data-tv-active={!filterCategorySlug ? "true" : undefined}
                  >
                    All Categories
                  </button>
                  {categoriesWithCount.map((category) => (
                    <button
                      key={String(category.slug || category.id || "")}
                      type="button"
                      className={`${styles.filterBtn} ${filterCategorySlug === category.slug ? styles.filterBtnActive : ""}`}
                      onClick={() => onSelectCategoryFilter?.(category.slug)}
                      data-tv-focusable="true"
                      data-tv-focus-scope="movie-filter-overlay"
                      data-tv-focus-id={`movie-tv-filter-category-global-${String(category.slug || category.id || "")}`}
                      data-tv-active={filterCategorySlug === category.slug ? "true" : undefined}
                    >
                      {category.name} ({category.count})
                    </button>
                  ))}
                </>
              )}
            </div>
          </section>

          {!showInlineFilters ? (
            <>
              <section className={styles.tvFilterSection}>
                <header className={styles.tvFilterSectionHead}>
                  <strong>Genres</strong>
                </header>
                <div className={styles.tvFilterSectionBody}>
                  <button
                    type="button"
                    className={`${styles.filterBtn} ${!filterGenreSlug ? styles.filterBtnActive : ""}`}
                    onClick={() => onSelectGenreFilter?.("")}
                    data-tv-focusable="true"
                    data-tv-focus-scope="movie-filter-overlay"
                    data-tv-focus-id="movie-tv-filter-genre-all"
                    data-tv-active={!filterGenreSlug ? "true" : undefined}
                  >
                    All Genres
                  </button>
                  {facetedGenreOptions.map((genre) => (
                    <button
                      key={String(genre.key || genre.name || "")}
                      type="button"
                      className={`${styles.filterBtn} ${String(filterGenreSlug || "").trim().toLowerCase() === genre.key ? styles.filterBtnActive : ""}`}
                      onClick={() => onSelectGenreFilter?.(genre.key)}
                      data-tv-focusable="true"
                      data-tv-focus-scope="movie-filter-overlay"
                      data-tv-focus-id={`movie-tv-filter-genre-${genre.key}`}
                      data-tv-active={String(filterGenreSlug || "").trim().toLowerCase() === genre.key ? "true" : undefined}
                    >
                      {genre.name} ({Number(genre.count || 0)})
                    </button>
                  ))}
                </div>
              </section>

              <section className={styles.tvFilterSection}>
                <header className={styles.tvFilterSectionHead}>
                  <strong>Languages</strong>
                </header>
                <div className={styles.tvFilterSectionBody}>
                  <button
                    type="button"
                    className={`${styles.filterBtn} ${!filterLanguageSlug ? styles.filterBtnActive : ""}`}
                    onClick={() => onSelectLanguageFilter?.("")}
                    data-tv-focusable="true"
                    data-tv-focus-scope="movie-filter-overlay"
                    data-tv-focus-id="movie-tv-filter-language-all"
                    data-tv-active={!filterLanguageSlug ? "true" : undefined}
                  >
                    All Languages
                  </button>
                  {facetedLanguageOptions.map((language) => (
                    <button
                      key={String(language.key || language.name || "")}
                      type="button"
                      className={`${styles.filterBtn} ${String(filterLanguageSlug || "").trim().toLowerCase() === language.key ? styles.filterBtnActive : ""}`}
                      onClick={() => onSelectLanguageFilter?.(language.key)}
                      data-tv-focusable="true"
                      data-tv-focus-scope="movie-filter-overlay"
                      data-tv-focus-id={`movie-tv-filter-language-${language.key}`}
                      data-tv-active={String(filterLanguageSlug || "").trim().toLowerCase() === language.key ? "true" : undefined}
                    >
                      {language.name} ({Number(language.count || 0)})
                    </button>
                  ))}
                </div>
              </section>

              <section className={styles.tvFilterSection}>
                <header className={styles.tvFilterSectionHead}>
                  <strong>Years</strong>
                </header>
                <div className={styles.tvFilterSectionBody}>
                  <button
                    type="button"
                    className={`${styles.filterBtn} ${!filterYear ? styles.filterBtnActive : ""}`}
                    onClick={() => onSelectYearFilter?.("")}
                    data-tv-focusable="true"
                    data-tv-focus-scope="movie-filter-overlay"
                    data-tv-focus-id="movie-tv-filter-year-all"
                    data-tv-active={!filterYear ? "true" : undefined}
                  >
                    All Years
                  </button>
                  {facetedYearOptions.slice(0, 18).map((yearRow) => (
                    <button
                      key={String(yearRow.key || yearRow.name || "")}
                      type="button"
                      className={`${styles.filterBtn} ${String(filterYear || "").trim() === String(yearRow.key || "") ? styles.filterBtnActive : ""}`}
                      onClick={() => onSelectYearFilter?.(String(yearRow.key || ""))}
                      data-tv-focusable="true"
                      data-tv-focus-scope="movie-filter-overlay"
                      data-tv-focus-id={`movie-tv-filter-year-${String(yearRow.key || "")}`}
                      data-tv-active={String(filterYear || "").trim() === String(yearRow.key || "") ? "true" : undefined}
                    >
                      {yearRow.name} ({Number(yearRow.count || 0)})
                    </button>
                  ))}
                </div>
              </section>
            </>
          ) : null}

          {activeFilterControls ? (
            <section className={styles.tvFilterSection}>
              <header className={styles.tvFilterSectionHead}>
                <strong>Active Filters</strong>
              </header>
              {activeFilterControls}
            </section>
          ) : null}
        </div>
      </aside>
    </>
  ) : null;

  const showMobileEdgeTools = isMobilePortraitUi && !isDocumentFullscreen;

  useEffect(() => {
    if (showMobileEdgeTools) return;
    setMobileSearchOpen(false);
    setMobileFilterOpen(false);
  }, [showMobileEdgeTools]);

  useEffect(() => {
    if (isMobileFilterUi) {
      if (typeof window !== "undefined") {
        window.clearTimeout(desktopSearchCloseTimerRef.current);
      }
      setDesktopSearchClosing(false);
      setDesktopSearchOpen(false);
    }
  }, [isMobileFilterUi]);

  useEffect(() => {
    if (!desktopSearchOpen || desktopSearchClosing || typeof window === "undefined") return undefined;
    const focusInput = window.requestAnimationFrame(() => {
      if (desktopSearchInputRef.current instanceof HTMLElement) {
        desktopSearchInputRef.current.focus();
      }
    });
    const handleKeyDown = (event) => {
      if (event.key === "Escape") closeDesktopSearch();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusInput);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeDesktopSearch, desktopSearchClosing, desktopSearchOpen]);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined") {
        window.clearTimeout(desktopSearchCloseTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (variant === "browse" && isTvMode) return;
    setTvSearchOpen(false);
    setTvFilterOpen(false);
  }, [isTvMode, variant]);

  useEffect(() => {
    if (!isTvMode || typeof window === "undefined") return undefined;
    const scope = tvSearchOpen
      ? "movie-search-overlay"
      : tvFilterOpen
        ? "movie-filter-overlay"
        : "movie-content";
    window.dispatchEvent(new CustomEvent("tv-focus-scope-change", { detail: { scope } }));
    return () => {
      window.dispatchEvent(new CustomEvent("tv-focus-scope-change", { detail: { scope: "" } }));
    };
  }, [isTvMode, tvFilterOpen, tvSearchOpen]);

  useEffect(() => {
    if (!isTvMode || !tvSearchOpen || typeof window === "undefined") return undefined;
    const focusOverlayInput = () => {
      if (tvSearchInputRef.current instanceof HTMLElement) {
        tvSearchInputRef.current.focus();
        return;
      }
      focusTvElementById("movie-tv-search-input");
    };
    const rafId = window.requestAnimationFrame(focusOverlayInput);
    return () => window.cancelAnimationFrame(rafId);
  }, [focusTvElementById, isTvMode, tvSearchOpen]);

  useEffect(() => {
    if (!isTvMode || !tvFilterOpen || typeof window === "undefined") return undefined;
    const rafId = window.requestAnimationFrame(() => {
      focusTvElementById("movie-tv-filter-clear-all");
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [focusTvElementById, isTvMode, tvFilterOpen]);

  useEffect(() => {
    if (variant !== "watch" || !isTvMode) return;
    setTvWatchPlaybackOpen(false);
  }, [isTvMode, selectedMovieId, variant]);

  useEffect(() => {
    if (!isTvMode || variant !== "watch" || !tvWatchPlaybackOpen || typeof window === "undefined") return undefined;
    const onTvBack = () => {
      setTvWatchPlaybackOpen(false);
      exitMovieFullscreen().catch(() => {});
    };
    window.addEventListener("tv-back", onTvBack);
    return () => window.removeEventListener("tv-back", onTvBack);
  }, [isTvMode, tvWatchPlaybackOpen, variant]);

  useEffect(() => {
    if (!isTvMode || variant !== "watch" || tvWatchPlaybackOpen || typeof window === "undefined") return undefined;
    const onTvBack = () => {
      onBackToMovieList?.();
    };
    window.addEventListener("tv-back", onTvBack);
    return () => window.removeEventListener("tv-back", onTvBack);
  }, [isTvMode, onBackToMovieList, tvWatchPlaybackOpen, variant]);

  useEffect(() => {
    if (!isTvMode || (!tvSearchOpen && !tvFilterOpen) || typeof window === "undefined") return undefined;
    const onTvBack = () => {
      if (tvSearchOpen) closeTvSearchOverlay();
      if (tvFilterOpen) closeTvFilterOverlay();
    };
    window.addEventListener("tv-back", onTvBack);
    return () => window.removeEventListener("tv-back", onTvBack);
  }, [closeTvFilterOverlay, closeTvSearchOverlay, isTvMode, tvFilterOpen, tvSearchOpen]);
  const mobileEdgeTools = showMobileEdgeTools ? (
    <div
      className={styles.mobileSectionEdgeTools}
      style={{ bottom: `${mobileEdgeBottom}px` }}
    >
      <button
        type="button"
        className={`${styles.mobileEdgeToggle} ${styles.mobileEdgeToggleLeft}`}
        onClick={() => {
          setMobileSearchOpen(false);
          setMobileFilterOpen(true);
        }}
        aria-label="Open movie filter"
        title="Open movie filter"
      >
        <SlidersHorizontal size={16} strokeWidth={2.2} />
        <span>Movie Filter</span>
      </button>
      <button
        type="button"
        className={`${styles.mobileEdgeToggle} ${styles.mobileEdgeToggleRight}`}
        onClick={() => {
          setMobileFilterOpen(false);
          setMobileSearchOpen(true);
        }}
        aria-label="Open movie search"
        title="Open movie search"
      >
        <Search size={16} strokeWidth={2.2} />
        <span>Search Movie</span>
      </button>
    </div>
  ) : null;

  const desktopSearchOverlay =
    !isTvMode && !isMobileFilterUi && (desktopSearchOpen || desktopSearchClosing) ? (
      <>
        <button
          type="button"
          aria-label="Close movie search"
          className={`${styles.desktopSearchBackdrop} ${
            desktopSearchClosing ? styles.desktopSearchBackdropClosing : styles.desktopSearchBackdropOpen
          }`}
          onClick={closeDesktopSearch}
        />
        <div
          className={styles.desktopSearchOverlay}
          role="dialog"
          aria-modal="true"
          aria-label="Movie search"
          style={{
            "--desktop-search-origin-x": `${desktopSearchOrigin.x}px`,
            "--desktop-search-origin-y": `${desktopSearchOrigin.y}px`,
          }}
        >
          <div
            className={`${styles.desktopSearchPanel} ${
              desktopSearchClosing ? styles.desktopSearchPanelClosing : styles.desktopSearchPanelOpen
            }`}
          >
            <div className={styles.desktopSearchHead}>
              <div className={styles.desktopSearchTitleWrap}>
                <Search size={18} strokeWidth={2.2} />
                <strong>Search Movie</strong>
              </div>
              <button
                type="button"
                className={styles.desktopSearchClose}
                onClick={closeDesktopSearch}
                aria-label="Close search panel"
              >
                <X size={18} strokeWidth={2.2} />
              </button>
            </div>
            <div className={styles.desktopSearchBody}>
              <div className={styles.desktopSearchInputWrap}>
                <input
                  ref={desktopSearchInputRef}
                  value={searchDraft}
                  onChange={(event) => setSearchDraft(event.target.value)}
                  placeholder="Search movies..."
                  className={`${styles.searchInput} ${styles.desktopSearchInput}`}
                />
                {isSearchBusy ? (
                  <span className={styles.searchStatusBadge}>
                    {searchPendingText}
                  </span>
                ) : null}
              </div>
              <div className={styles.desktopSearchMeta}>
                <span className={styles.mobileSearchCount}>
                  {String(searchDraft || "").trim()
                    ? isSearchBusy
                      ? searchPendingText
                      : `${mobileSearchResults.length} result${mobileSearchResults.length === 1 ? "" : "s"}`
                    : "Browse suggestions"}
                </span>
                <button type="button" className={styles.mobileSearchClearBtn} onClick={clearSearchOnly}>
                  Clear Search
                </button>
              </div>
              <div className={styles.desktopSearchResults}>
                {isSearchBusy ? (
                  <div className={styles.searchLoadingState}>
                    <span className={styles.loadingSpinner} aria-hidden="true" />
                    <p className={styles.mobileSearchEmpty}>{searchPendingText}</p>
                  </div>
                ) : mobileSearchResults.length ? (
                  mobileSearchResults.map((movie) => (
                    <button
                      key={`desktop-search-${String(movie?.id || movie?.slug || "")}`}
                      type="button"
                      className={styles.mobileSearchResultItem}
                    onClick={() => {
                      handleSelectMovie(movie);
                      closeDesktopSearch();
                    }}
                  >
                      {movie?.posterUrl ? (
                        <img src={movie.posterUrl} alt="" className={styles.mobileSearchResultPoster} />
                      ) : (
                        <span className={styles.mobileSearchResultPosterFallback}>No Poster</span>
                      )}
                      <span className={styles.mobileSearchResultText}>
                        <strong>{movie?.title || "Untitled"}</strong>
                        <span>
                          {movie?.releaseYear || "Year unknown"}
                          {movie?.imdbRating ? ` | IMDb ${movie.imdbRating}` : ""}
                        </span>
                      </span>
                    </button>
                  ))
                ) : (
                  <p className={styles.mobileSearchEmpty}>No movies matched this search.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </>
    ) : null;

  const desktopHeroUtility =
    !isTvMode && !isMobileFilterUi && activeHeroMovie ? (
      <div className={styles.desktopHeroUtility} aria-label="Featured movie controls">
        <button
          ref={desktopSearchTriggerRef}
          type="button"
          className={styles.heroIconBtn}
          onClick={openDesktopSearch}
          aria-label="Open movie search"
        >
          <Search size={18} strokeWidth={2.1} />
        </button>
      </div>
    ) : null;

  const handleHeroTouchStart = useCallback((event) => {
    const touch = event?.touches?.[0];
    if (!touch) return;
    heroTouchStartXRef.current = Number(touch.clientX || 0);
    heroTouchStartYRef.current = Number(touch.clientY || 0);
  }, []);

  const handleHeroTouchEnd = useCallback(
    (event) => {
      if (heroMovies.length <= 1) return;
      const touch = event?.changedTouches?.[0];
      if (!touch) return;
      const endX = Number(touch.clientX || 0);
      const endY = Number(touch.clientY || 0);
      const dx = endX - heroTouchStartXRef.current;
      const dy = endY - heroTouchStartYRef.current;
      if (Math.abs(dx) < 34 || Math.abs(dx) <= Math.abs(dy)) return;
      setHeroIndex((prev) => {
        if (dx < 0) return (prev + 1) % heroMovies.length;
        return (prev - 1 + heroMovies.length) % heroMovies.length;
      });
    },
    [heroMovies.length]
  );

  const upsertMovieProgress = useCallback((movieId, progress) => {
    const id = String(movieId || "");
    if (!id) return;
    const patch = { progress };
    let patchedMovie = null;

    setMovies((prev) =>
      prev.map((movie) => {
        if (String(movie?.id || "") !== id) return movie;
        patchedMovie = mergeMoviePatch(movie, patch);
        return patchedMovie;
      })
    );
    setContinueItems((prev) => {
      let nextMovie = patchedMovie;
      const next = prev.map((movie) => {
        if (String(movie?.id || "") !== id) return movie;
        nextMovie = mergeMoviePatch(movie, patch);
        return nextMovie;
      });

      if (!nextMovie) {
        const sourceMovie =
          movies.find((movie) => String(movie?.id || "") === id) ||
          prev.find((movie) => String(movie?.id || "") === id) ||
          (String(selectedMovie?.id || "") === id ? selectedMovie : null);
        if (sourceMovie) nextMovie = mergeMoviePatch(sourceMovie, patch);
      }

      return upsertContinueItems(next, nextMovie);
    });
  }, [movies, selectedMovie]);

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
    setContinueItems((prev) =>
      prev.map((row) => (String(row?.id || "") === id ? { ...row, isFavorite: nextFavorite } : row))
    );

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
        setContinueItems((prev) =>
          prev.map((row) => (String(row?.id || "") === id ? { ...row, isFavorite: !nextFavorite } : row))
        );
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

  const handleOpenTvPlayback = useCallback(
    (movie, startMode = "resume") => {
      const id = String(movie?.id || selectedMovie?.id || "");
      if (id) setSelectedMovieId(id);
      const progressFrom = Number(movie?.progress?.positionSeconds || selectedMovie?.progress?.positionSeconds || 0);
      if (startMode === "restart") {
        setPlayerStartFrom(0);
      } else {
        setPlayerStartFrom(progressFrom > 0 ? progressFrom : 0);
      }
      setPlayerReplayToken((prev) => prev + 1);
      setTvWatchPlaybackOpen(true);
    },
    [selectedMovie]
  );

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
    if (isTvMode && !tvWatchPlaybackOpen) {
      const hasResumePoint = Number(selectedMovie?.progress?.positionSeconds || 0) > 30;
      return (
        <section className={`${styles.wrap} ${styles.wrapWatch} ${styles.wrapTvWatch}`}>
          <div className={`${styles.watchPlayerCol} ${styles.watchPlayerColTv}`}>
            <section className={`${styles.sectionCard} ${styles.sectionCardTv}`}>
              <div className={styles.tvHeroBody}>
                <div className={styles.tvHeroEyebrow}>Movie Details</div>
                <h2 className={styles.tvHeroTitle}>{selectedMovie?.title || "Selected Movie"}</h2>
                <div className={styles.tvHeroActions}>
                  <button
                    type="button"
                    className={styles.primaryBtn}
                    onClick={() => handleOpenTvPlayback(selectedMovie, hasResumePoint ? "resume" : "restart")}
                    data-tv-focusable="true"
                    data-tv-focus-scope="movie-content"
                    data-tv-focus-id="movie-tv-watch-play"
                    data-tv-default-focus="true"
                    data-tv-nav-row="0"
                    data-tv-nav-col="0"
                  >
                    <Play size={18} />
                    {hasResumePoint ? "Resume Movie" : "Play Movie"}
                  </button>
                  <button
                    type="button"
                    className={styles.secondaryBtn}
                    onClick={() => handleOpenTvPlayback(selectedMovie, "restart")}
                    data-tv-focusable="true"
                    data-tv-focus-scope="movie-content"
                    data-tv-focus-id="movie-tv-watch-restart"
                    data-tv-nav-row="0"
                    data-tv-nav-col="1"
                  >
                    <RotateCcw size={18} />
                    Restart
                  </button>
                  <button
                    type="button"
                    className={styles.secondaryBtn}
                    onClick={() => onBackToMovieList?.()}
                    data-tv-focusable="true"
                    data-tv-focus-scope="movie-content"
                    data-tv-focus-id="movie-tv-watch-back-list"
                    data-tv-nav-row="0"
                    data-tv-nav-col="2"
                  >
                    <ArrowLeft size={18} />
                    Back to Movie List
                  </button>
                </div>
              </div>
            </section>
            <section className={`${styles.sectionCard} ${styles.sectionCardTv}`}>
              <MovieDetail movie={selectedMovie} isTvMode={true} mode="metadata" />
            </section>
          </div>
          <aside className={`${styles.watchInfoCol} ${styles.watchInfoColTv}`}>
            <section className={`${styles.sectionCard} ${styles.sectionCardTv}`}>
              <MovieDetail movie={selectedMovie} isTvMode={true} mode="poster" />
            </section>
          </aside>
        </section>
      );
    }

    return (
      <>
        <section className={`${styles.wrap} ${styles.wrapWatch} ${isTvMode ? styles.wrapTvWatch : ""}`}>
          <div ref={watchPlayerColRef} className={`${styles.watchPlayerCol} ${isTvMode ? styles.watchPlayerColTv : ""}`}>
            <MoviePlayer
              movie={selectedMovie}
              isTvMode={isTvMode}
              startFrom={playerStartFrom}
              replayToken={playerReplayToken}
              autoStartPlayback={true}
              autoEnterFullscreen={isTvMode}
              onRestart={handleRestartAction}
              onMarkComplete={handleMarkComplete}
              onToggleFavorite={handleToggleFavorite}
              onBackToList={() => {
                if (isTvMode) {
                  setTvWatchPlaybackOpen(false);
                  exitMovieFullscreen().catch(() => {});
                  return;
                }
                onBackToMovieList?.();
              }}
              onProgressSaved={upsertMovieProgress}
              onMarkedComplete={handleMarkedComplete}
              onTrackActivity={onTrackActivity}
            />
          </div>
          <aside className={`${styles.watchInfoCol} ${isTvMode ? styles.watchInfoColTv : ""}`}>
            <MovieDetail movie={selectedMovie} isTvMode={isTvMode} />
          </aside>
        </section>
        {mobileEdgeTools}
        {isMobileFilterUi ? (
          <>
            {mobileSearchOpen || mobileFilterOpen ? (
              <button
                type="button"
                aria-label="Close mobile drawer"
                className={`${styles.mobileDrawerBackdrop} ${styles.mobileDrawerBackdropOpen}`}
                onClick={() => {
                  setMobileSearchOpen(false);
                  setMobileFilterOpen(false);
                }}
              />
            ) : null}
            <aside
              className={`${styles.mobileDrawer} ${styles.mobileDrawerLeft} ${
                mobileFilterOpen ? styles.mobileDrawerOpen : ""
              }`}
              aria-hidden={!mobileFilterOpen}
            >
              <div className={styles.mobileDrawerHead}>
                <div className={styles.mobileDrawerTitleWrap}>
                  <SlidersHorizontal size={18} strokeWidth={2.2} />
                  <strong>Movie Filter</strong>
                </div>
                <button
                  type="button"
                  className={styles.mobileDrawerClose}
                  onClick={() => setMobileFilterOpen(false)}
                  aria-label="Close filter panel"
                >
                  <X size={18} strokeWidth={2.2} />
                </button>
              </div>
              <div className={styles.mobileDrawerBody}>
                {filterControls}
                {activeFilterControls}
              </div>
            </aside>
            <aside
              className={`${styles.mobileDrawer} ${styles.mobileDrawerRight} ${
                mobileSearchOpen ? styles.mobileDrawerOpen : ""
              }`}
              aria-hidden={!mobileSearchOpen}
            >
              <div className={styles.mobileDrawerHead}>
                <div className={styles.mobileDrawerTitleWrap}>
                  <Search size={18} strokeWidth={2.2} />
                  <strong>Search Movie</strong>
                </div>
                <button
                  type="button"
                  className={styles.mobileDrawerClose}
                  onClick={() => setMobileSearchOpen(false)}
                  aria-label="Close search panel"
                >
                  <X size={18} strokeWidth={2.2} />
                </button>
              </div>
              <div className={styles.mobileDrawerBody}>
                {searchControls}
                <div className={styles.mobileSearchMeta}>
                  <span className={styles.mobileSearchCount}>
                    {String(searchDraft || "").trim()
                      ? isSearchBusy
                        ? searchPendingText
                        : `${mobileSearchResults.length} result${mobileSearchResults.length === 1 ? "" : "s"}`
                      : "All movies"}
                  </span>
                  <button type="button" className={styles.mobileSearchClearBtn} onClick={clearSearchOnly}>
                    Clear Search
                  </button>
                </div>
                <div className={styles.mobileSearchResults}>
                  {isSearchBusy ? (
                    <div className={styles.searchLoadingState}>
                      <span className={styles.loadingSpinner} aria-hidden="true" />
                      <p className={styles.mobileSearchEmpty}>{searchPendingText}</p>
                    </div>
                  ) : mobileSearchResults.length ? (
                    mobileSearchResults.map((movie) => (
                      <button
                        key={String(movie?.id || movie?.slug || "")}
                        type="button"
                        className={styles.mobileSearchResultItem}
                        onClick={() => {
                          handleSelectMovie(movie);
                          setMobileSearchOpen(false);
                        }}
                        data-tv-focusable={isTvMode ? "true" : undefined}
                        data-tv-focus-scope={isTvMode ? "movie-content" : undefined}
                        data-tv-focus-id={isTvMode ? `movie-search-result-${String(movie?.id || movie?.slug || "")}` : undefined}
                      >
                        {movie?.posterUrl ? (
                          <img src={movie.posterUrl} alt="" className={styles.mobileSearchResultPoster} />
                        ) : (
                          <span className={styles.mobileSearchResultPosterFallback}>No Poster</span>
                        )}
                        <span className={styles.mobileSearchResultText}>
                          <strong>{movie?.title || "Untitled"}</strong>
                          <span>
                            {movie?.releaseYear || "Year unknown"}
                            {movie?.imdbRating ? ` | IMDb ${movie.imdbRating}` : ""}
                          </span>
                        </span>
                      </button>
                    ))
                  ) : (
                    <p className={styles.mobileSearchEmpty}>No movies matched this search.</p>
                  )}
                </div>
              </div>
            </aside>
          </>
        ) : null}
      </>
    );
  }

  if (isTvMode) {
    const featuredSynopsis = text(tvFeaturedMovie?.synopsis) || "Browse and play movies with remote-friendly rails.";
    const featuredGenres = (Array.isArray(tvFeaturedMovie?.imdbGenres) ? tvFeaturedMovie.imdbGenres : [])
      .filter(Boolean)
      .slice(0, 3)
      .join(" • ");
    const hasActiveFilters = activeFilterTags.length > 0;

    return (
      <section className={`${styles.wrap} ${styles.wrapBrowse} ${styles.wrapTvBrowse}`}>
        <div className={styles.leftCol}>
          <section className={`${styles.sectionCard} ${styles.sectionCardTv} ${styles.tvHeroCard}`}>
            <div className={styles.tvHeroMedia}>
              {tvFeaturedMovie?.backdropUrl || tvFeaturedMovie?.posterUrl ? (
                <img
                  className={styles.tvHeroImage}
                  src={tvFeaturedMovie?.backdropUrl || tvFeaturedMovie?.posterUrl}
                  alt={tvFeaturedMovie?.title || "Featured movie"}
                />
              ) : (
                <div className={styles.tvHeroImageFallback} aria-hidden="true" />
              )}
            </div>
            <div className={styles.tvHeroBody}>
              <div className={styles.tvHeroEyebrow}>Featured Movie</div>
              <h2 className={styles.tvHeroTitle}>{tvFeaturedMovie?.title || "Movie Library"}</h2>
              <div className={styles.tvHeroMeta}>
                {tvFeaturedMovie?.releaseYear ? <span className={styles.detailChip}>{tvFeaturedMovie.releaseYear}</span> : null}
                {tvFeaturedMovie?.imdbRating ? <span className={styles.detailChip}>IMDb {tvFeaturedMovie.imdbRating}</span> : null}
                {featuredGenres ? <span className={styles.detailChip}>{featuredGenres}</span> : null}
              </div>
              <p className={styles.tvHeroSynopsis}>{featuredSynopsis}</p>
              <div className={styles.tvHeroActions}>
                <button
                  type="button"
                  className={styles.primaryBtn}
                  onClick={() => tvFeaturedMovie && handleSelectMovie(tvFeaturedMovie)}
                  data-tv-focusable="true"
                  data-tv-focus-scope="movie-content"
                  data-tv-focus-id="movie-tv-featured-play"
                  data-tv-default-focus="true"
                  data-tv-nav-row="0"
                  data-tv-nav-col="0"
                >
                  Play Movie
                </button>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={() => openTvSearchOverlay("movie-tv-open-search")}
                  data-tv-focusable="true"
                  data-tv-focus-scope="movie-content"
                  data-tv-focus-id="movie-tv-open-search"
                  data-tv-nav-row="0"
                  data-tv-nav-col="1"
                >
                  Search Movies
                </button>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={() => openTvFilterOverlay("movie-tv-open-filters")}
                  data-tv-focusable="true"
                  data-tv-focus-scope="movie-content"
                  data-tv-focus-id="movie-tv-open-filters"
                  data-tv-nav-row="0"
                  data-tv-nav-col="2"
                >
                  Browse Filters
                </button>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={() => tvFeaturedMovie && handleToggleFavorite(tvFeaturedMovie)}
                  data-tv-focusable="true"
                  data-tv-focus-scope="movie-content"
                  data-tv-focus-id="movie-tv-featured-favorite"
                  data-tv-nav-row="0"
                  data-tv-nav-col="3"
                >
                  {tvFeaturedMovie?.isFavorite ? "Favorited" : "Add Favorite"}
                </button>
                {hasActiveFilters ? (
                  <button
                    type="button"
                    className={styles.secondaryBtn}
                    onClick={clearAllFilters}
                    data-tv-focusable="true"
                    data-tv-focus-scope="movie-content"
                    data-tv-focus-id="movie-tv-clear-filters"
                    data-tv-nav-row="0"
                    data-tv-nav-col="4"
                  >
                    Clear Filters
                  </button>
                ) : null}
              </div>
            </div>
          </section>

          <section className={`${styles.sectionCard} ${styles.sectionCardTv} ${styles.tvBrowseSearchCard}`}>
            <header className={styles.sectionTop}>
              <h3 className={styles.sectionTitle}>Search & Active Filters</h3>
              <span className={styles.sectionHint}>{totalFilteredMovies} results</span>
            </header>
            <div className={styles.tvBrowseSearchActions}>
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={() => openTvSearchOverlay("movie-tv-search-card-open")}
                data-tv-focusable="true"
                data-tv-focus-scope="movie-content"
                data-tv-focus-id="movie-tv-search-card-open"
                data-tv-nav-row="1"
                data-tv-nav-col="0"
              >
                Open Search Overlay
              </button>
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={() => openTvFilterOverlay("movie-tv-search-card-filters")}
                data-tv-focusable="true"
                data-tv-focus-scope="movie-content"
                data-tv-focus-id="movie-tv-search-card-filters"
                data-tv-nav-row="1"
                data-tv-nav-col="1"
              >
                Open Filters
              </button>
              {String(searchDraft || "").trim() ? (
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={clearSearchOnly}
                  data-tv-focusable="true"
                  data-tv-focus-scope="movie-content"
                  data-tv-focus-id="movie-tv-search-card-clear"
                  data-tv-nav-row="1"
                  data-tv-nav-col="2"
                >
                  Clear Search
                </button>
              ) : null}
            </div>
            {activeFilterControls}
          </section>

          <div className={styles.tvRailStack}>
            {tvRailSections.map((section, sectionIndex) => (
              <section key={section.key} className={`${styles.sectionCard} ${styles.sectionCardTv} ${styles.tvRailSection}`}>
                <header className={styles.sectionTop}>
                  <h3 className={styles.sectionTitle}>{section.title}</h3>
                  <span className={styles.sectionCount}>{section.items.length}</span>
                </header>
                <div className={styles.tvRailBody}>
                  <div className={styles.tvRailStrip}>
                    {section.items.map((movie, movieIndex) => (
                      <div key={`${section.key}-${movie.id}`} className={styles.tvRailSlot}>
                        <MovieCard
                          movie={movie}
                          isActive={String(selectedMovieId || "") === String(movie.id || "")}
                          onSelect={handleSelectMovie}
                          onToggleFavorite={handleToggleFavorite}
                          isTvMode={true}
                          tvFocusScope="movie-content"
                          tvFocusId={`movie-tv-rail-${sectionIndex}-${String(movie.id || "")}`}
                          tvNavRow={sectionIndex + 2}
                          tvNavCol={movieIndex}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            ))}
          </div>
        </div>
        {tvSearchOverlay}
        {tvFilterOverlay}
      </section>
    );
  }

  return (
    <section className={`${styles.wrap} ${styles.wrapBrowse} ${isTvMode ? styles.wrapTvBrowse : ""}`}>
      <div className={styles.leftCol}>
        {!isTvMode && activeHeroMovie ? (
          <section
            ref={heroSectionRef}
            className={`${styles.sectionCard} ${styles.heroSection}`}
            onTouchStart={handleHeroTouchStart}
            onTouchEnd={handleHeroTouchEnd}
          >
            <div className={styles.heroBackdrop} aria-hidden="true">
              <img
                key={`hero-backdrop-${activeHeroMovie.id}`}
                className={styles.heroBackdropImage}
                src={activeHeroMovie.backdropUrl || activeHeroMovie.posterUrl}
                alt=""
              />
            </div>
            <div className={styles.heroStage}>
              <div className={styles.heroPosterCol}>
                <img
                  key={`hero-poster-${activeHeroMovie.id}`}
                  className={styles.heroPoster}
                  src={activeHeroMovie.posterUrl}
                  alt={`${activeHeroMovie.title || "Movie"} poster`}
                />
              </div>
              <div className={styles.heroBody}>
                <div className={styles.heroContentBackdrop} aria-hidden="true">
                  <img
                    key={`hero-content-backdrop-${activeHeroMovie.id}`}
                    className={styles.heroContentBackdropImage}
                    src={activeHeroMovie.backdropUrl || activeHeroMovie.posterUrl}
                    alt=""
                  />
                </div>
                <div className={styles.heroKickerRow}>
                  <span className={styles.heroKicker}>Featured Movies</span>
                </div>
                <div key={`hero-copy-${activeHeroMovie.id}`} className={styles.heroCopy}>
                  <h2 className={styles.heroTitle}>{activeHeroMovie.title || "Featured Movie"}</h2>
                  <div className={styles.heroMeta}>
                    {activeHeroMovie.releaseYear ? <span className={styles.heroChip}>{activeHeroMovie.releaseYear}</span> : null}
                    {activeHeroMovie.videoQuality ? <span className={styles.heroChip}>{activeHeroMovie.videoQuality}</span> : null}
                    {Number(activeHeroMovie.imdbRating || 0) > 0 ? (
                      <span className={styles.heroChip}>IMDb {Number(activeHeroMovie.imdbRating).toFixed(1)}</span>
                    ) : null}
                    {Array.isArray(activeHeroMovie.imdbGenres) && activeHeroMovie.imdbGenres.length ? (
                      <span className={styles.heroChip}>{activeHeroMovie.imdbGenres.slice(0, 2).join(" • ")}</span>
                    ) : null}
                  </div>
                  <p className={styles.heroSynopsis}>
                    {text(activeHeroMovie.synopsis) || "High-rated movie selected from the current catalog."}
                  </p>
                  <div className={styles.heroActionRow}>
                    <button
                      type="button"
                      className={styles.primaryBtn}
                      onClick={() => handleSelectMovie(activeHeroMovie)}
                      aria-label="Play Movie"
                    >
                      <Play size={18} />
                      <span className={styles.heroActionText}>Play Movie</span>
                    </button>
                    <button
                      type="button"
                      className={styles.secondaryBtn}
                      onClick={() => handleToggleFavorite(activeHeroMovie)}
                      aria-label={activeHeroMovie?.isFavorite ? "Favorited" : "Add Favorite"}
                    >
                      <Heart size={18} />
                      <span className={styles.heroActionText}>
                        {activeHeroMovie?.isFavorite ? "Favorited" : "Add Favorite"}
                      </span>
                    </button>
                  </div>
                </div>
                {heroMovies.length > 1 ? (
                  <div className={styles.heroDotRow}>
                    {heroMovies.map((movie, index) => (
                      <button
                        key={`hero-dot-${movie.id}`}
                        type="button"
                        className={`${styles.heroDot} ${index === heroIndex ? styles.heroDotActive : ""}`}
                        onClick={() => setHeroIndex(index)}
                        aria-label={`Show ${movie.title || "movie"}`}
                      />
                    ))}
                  </div>
                ) : null}
                {heroMovies.length > 1 ? (
                  <div className={styles.heroSlideNavDesktop} aria-label="Featured movie navigation">
                    <button
                      type="button"
                      className={styles.heroIconBtn}
                      onClick={() => setHeroIndex((prev) => (prev - 1 + heroMovies.length) % heroMovies.length)}
                      aria-label="Previous featured movie"
                    >
                      <ChevronLeft size={18} strokeWidth={2.2} />
                    </button>
                    <button
                      type="button"
                      className={styles.heroIconBtn}
                      onClick={() => setHeroIndex((prev) => (prev + 1) % heroMovies.length)}
                      aria-label="Next featured movie"
                    >
                      <ChevronRight size={18} strokeWidth={2.2} />
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}
        {continueWatching.length ? (
          <section className={`${styles.sectionCard} ${styles.sectionContinue} ${isTvMode ? styles.sectionCardTv : ""}`}>
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
                      isTvMode={isTvMode}
                      tvFocusScope="movie-content"
                      tvFocusId={`movie-continue-${String(movie.id || "")}`}
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
                          data-tv-focusable={isTvMode ? "true" : undefined}
                          data-tv-focus-scope={isTvMode ? "movie-content" : undefined}
                          data-tv-focus-id={isTvMode ? "movie-continue-prev" : undefined}
                        />
                      </PaginationItem>
                      {continuePageItems.map((item) => (
                        <PaginationItem key={`continue-${String(item)}`}>
                          {typeof item === "number" ? (
                            <PaginationLink
                              isActive={item === currentContinuePage}
                              size="icon"
                              onClick={() => setContinuePage(item)}
                              data-tv-focusable={isTvMode ? "true" : undefined}
                              data-tv-focus-scope={isTvMode ? "movie-content" : undefined}
                              data-tv-focus-id={isTvMode ? `movie-continue-page-${item}` : undefined}
                              data-tv-active={isTvMode && item === currentContinuePage ? "true" : undefined}
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
                          data-tv-focusable={isTvMode ? "true" : undefined}
                          data-tv-focus-scope={isTvMode ? "movie-content" : undefined}
                          data-tv-focus-id={isTvMode ? "movie-continue-next" : undefined}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        <section className={`${styles.sectionCard} ${styles.sectionControls} ${isTvMode ? styles.sectionCardTv : ""}`}>
          <header className={styles.sectionTop}>
            <h3 className={styles.sectionTitle}>Search & Filtering</h3>
            <span className={styles.sectionHint}>
              {isSearchSyncing ? "Typing..." : isSearchLoading ? "Searching..." : "Live results"}
            </span>
          </header>
          {searchControls}
          {filterControls}
          {activeFilterControls}
        </section>

        <section className={`${styles.sectionCard} ${styles.sectionMovies} ${isTvMode ? styles.sectionCardTv : ""}`} ref={moviesSectionRef}>
          <header className={styles.sectionTop}>
            <h3 className={styles.sectionTitle}>Movies</h3>
            <div className={styles.sectionTopMeta}>
              <span className={styles.sectionHint}>
                {totalFilteredMovies} result{totalFilteredMovies === 1 ? "" : "s"}
              </span>
            </div>
          </header>
          <div className={styles.moviesGridWrap}>
            <MovieGrid
              title=""
              movies={pagedMovies}
              selectedMovieId={selectedMovieId}
              onSelectMovie={handleSelectMovie}
              onToggleFavorite={handleToggleFavorite}
              onMetricsChange={handleGridMetricsChange}
              isTvMode={isTvMode}
              tvFocusScope="movie-content"
            />
            {isPageLoading && !hasLocalClientFilters && !String(search || "").trim() ? (
              <div className={styles.gridLoadingOverlay} aria-live="polite">
                <div className={`${styles.gridLoadingCard} ${styles.gridLoadingCardFloating}`}>
                  <span className={styles.loadingSpinner} aria-hidden="true" />
                  <span>Loading page {currentPage}...</span>
                </div>
              </div>
            ) : null}
          </div>
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
                      disabled={isPageLoading || currentPage <= 1}
                      onClick={() => {
                        goToMoviePage(currentPage - 1);
                      }}
                      data-tv-focusable={isTvMode ? "true" : undefined}
                      data-tv-focus-scope={isTvMode ? "movie-content" : undefined}
                      data-tv-focus-id={isTvMode ? "movie-grid-prev" : undefined}
                    />
                  </PaginationItem>
                  {pageItems.map((item) => (
                    <PaginationItem key={String(item)}>
                      {typeof item === "number" ? (
                        <PaginationLink
                          isActive={item === currentPage}
                          size="icon"
                          disabled={isPageLoading}
                          onClick={() => {
                            goToMoviePage(item);
                          }}
                          data-tv-focusable={isTvMode ? "true" : undefined}
                          data-tv-focus-scope={isTvMode ? "movie-content" : undefined}
                          data-tv-focus-id={isTvMode ? `movie-grid-page-${item}` : undefined}
                          data-tv-active={isTvMode && item === currentPage ? "true" : undefined}
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
                      disabled={isPageLoading || currentPage >= totalPages}
                      onClick={() => {
                        goToMoviePage(currentPage + 1);
                      }}
                      data-tv-focusable={isTvMode ? "true" : undefined}
                      data-tv-focus-scope={isTvMode ? "movie-content" : undefined}
                      data-tv-focus-id={isTvMode ? "movie-grid-next" : undefined}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          </div>
        </section>
      </div>
      {mobileEdgeTools}
      {desktopHeroUtility}
      {desktopSearchOverlay}
      {isMobileFilterUi ? (
        <>
          {mobileSearchOpen || mobileFilterOpen ? (
            <button
              type="button"
              aria-label="Close mobile drawer"
              className={`${styles.mobileDrawerBackdrop} ${styles.mobileDrawerBackdropOpen}`}
              onClick={() => {
                setMobileSearchOpen(false);
                setMobileFilterOpen(false);
              }}
            />
          ) : null}
          <aside
            className={`${styles.mobileDrawer} ${styles.mobileDrawerLeft} ${
              mobileFilterOpen ? styles.mobileDrawerOpen : ""
            }`}
            aria-hidden={!mobileFilterOpen}
          >
            <div className={styles.mobileDrawerHead}>
              <div className={styles.mobileDrawerTitleWrap}>
                <SlidersHorizontal size={18} strokeWidth={2.2} />
                <strong>Movie Filter</strong>
              </div>
              <button
                type="button"
                className={styles.mobileDrawerClose}
                onClick={() => setMobileFilterOpen(false)}
                aria-label="Close filter panel"
              >
                <X size={18} strokeWidth={2.2} />
              </button>
            </div>
            <div className={styles.mobileDrawerBody}>
              {filterControls}
              {activeFilterControls}
            </div>
          </aside>
          <aside
            className={`${styles.mobileDrawer} ${styles.mobileDrawerRight} ${
              mobileSearchOpen ? styles.mobileDrawerOpen : ""
            }`}
            aria-hidden={!mobileSearchOpen}
          >
            <div className={styles.mobileDrawerHead}>
              <div className={styles.mobileDrawerTitleWrap}>
                <Search size={18} strokeWidth={2.2} />
                <strong>Search Movie</strong>
              </div>
              <button
                type="button"
                className={styles.mobileDrawerClose}
                onClick={() => setMobileSearchOpen(false)}
                aria-label="Close search panel"
              >
                <X size={18} strokeWidth={2.2} />
              </button>
            </div>
            <div className={styles.mobileDrawerBody}>
              {searchControls}
              <div className={styles.mobileSearchMeta}>
                <span className={styles.mobileSearchCount}>
                  {String(searchDraft || "").trim()
                    ? isSearchBusy
                      ? searchPendingText
                      : `${mobileSearchResults.length} result${mobileSearchResults.length === 1 ? "" : "s"}`
                    : "All movies"}
                </span>
                <button type="button" className={styles.mobileSearchClearBtn} onClick={clearSearchOnly}>
                  Clear Search
                </button>
              </div>
              <div className={styles.mobileSearchResults}>
                {isSearchBusy ? (
                  <div className={styles.searchLoadingState}>
                    <span className={styles.loadingSpinner} aria-hidden="true" />
                    <p className={styles.mobileSearchEmpty}>{searchPendingText}</p>
                  </div>
                ) : mobileSearchResults.length ? (
                  mobileSearchResults.map((movie) => (
                    <button
                      key={String(movie?.id || movie?.slug || "")}
                      type="button"
                      className={styles.mobileSearchResultItem}
                      onClick={() => {
                        handleSelectMovie(movie);
                        setMobileSearchOpen(false);
                      }}
                      data-tv-focusable={isTvMode ? "true" : undefined}
                      data-tv-focus-scope={isTvMode ? "movie-content" : undefined}
                      data-tv-focus-id={isTvMode ? `movie-search-result-${String(movie?.id || movie?.slug || "")}` : undefined}
                    >
                      {movie?.posterUrl ? (
                        <img src={movie.posterUrl} alt="" className={styles.mobileSearchResultPoster} />
                      ) : (
                        <span className={styles.mobileSearchResultPosterFallback}>No Poster</span>
                      )}
                      <span className={styles.mobileSearchResultText}>
                        <strong>{movie?.title || "Untitled"}</strong>
                        <span>
                          {movie?.releaseYear || "Year unknown"}
                          {movie?.imdbRating ? ` | IMDb ${movie.imdbRating}` : ""}
                        </span>
                      </span>
                    </button>
                  ))
                ) : (
                  <p className={styles.mobileSearchEmpty}>No movies matched this search.</p>
                )}
              </div>
            </div>
          </aside>
        </>
      ) : !showInlineFilters || activeFilterTags.length ? (
        <div className={styles.filterDock}>
          <div className={styles.filterDockInner}>
            <div className={styles.filterDockRow}>
              <div className={styles.filterDockChips}>
                {activeFilterTags.map((tag) => (
                  <button
                    key={tag.key}
                    type="button"
                    className={styles.activeFilterChip}
                    onClick={() => clearFilterTag(tag.key)}
                    title="Clear this filter"
                  >
                    {tag.label} ×
                  </button>
                ))}
              </div>
              {activeFilterTags.length ? (
                <button type="button" className={styles.filterDockClearBtn} onClick={clearAllFilters}>
                  Clear All Filters
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
