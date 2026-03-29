"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import LeftSidebar from "./LeftSidebar";
import RightPanel from "./RightPanel";
import TopNavbar from "./TopNavbar";
import VideoPlayer from "./VideoPlayer";
import CookieConsentBanner from "./CookieConsentBanner";
import styles from "./iptv.module.css";
import { usePersistentArray } from "./usePersistentArray";
import { buildWatchPath } from "../../lib/channelSlug";
const MoviesView = dynamic(() => import("../movies/MoviesView"), {
  loading: () => null,
});

const LAST_CHANNEL_KEY = "iptv:v1:last-channel-id";
const LAST_MODE_KEY = "iptv:v1:last-mode";
const LAST_MOVIE_FILTER_KEY = "iptv:v1:last-movie-filter";
const DEVICE_KEY_STORAGE = "iptv:v1:device-key";
const DEFAULT_MOVIES_PAGE_SIZE = 24;

function normalizeChannelId(value) {
  return String(value || "").trim();
}

function toCategoryId(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function readMoviePageFromUrl() {
  if (typeof window === "undefined") return 1;
  try {
    const params = new URLSearchParams(window.location.search || "");
    const page = Number.parseInt(String(params.get("movie_page") || "1"), 10);
    return Math.max(1, Number.isFinite(page) ? page : 1);
  } catch {
    return 1;
  }
}

function buildMovieRequestQuery({ page = 1, pageSize = DEFAULT_MOVIES_PAGE_SIZE, mode = "all", category = "", genre = "", language = "", year = "" } = {}) {
  return {
    page: Math.max(1, Number(page || 1)),
    pageSize: Math.max(1, Number(pageSize || DEFAULT_MOVIES_PAGE_SIZE)),
    mode: String(mode || "all").trim().toLowerCase(),
    category: String(category || "").trim().toLowerCase(),
    genre: String(genre || "").trim().toLowerCase(),
    language: String(language || "").trim().toLowerCase(),
    year: String(year || "").trim(),
  };
}

function buildMovieRequestKey(query) {
  const normalized = buildMovieRequestQuery(query);
  return JSON.stringify(normalized);
}

function buildMoviePageCacheKey(query) {
  return buildMovieRequestKey(query);
}

export default function IptvHomeClient({
  initialChannels = [],
  initialCategories = [],
  initialMovies = [],
  initialMovieCategories = [],
  initialMovieGenres = [],
  initialMovieLanguages = [],
  initialMovieYears = [],
  initialMovieStats = {},
  initialContinueWatching = [],
  moviesViewVariant = "browse",
  initialHomeMode = "",
  initialMovieMode = "all",
  initialMovieCategory = "",
  initialMovieGenre = "",
  initialMovieLanguage = "",
  initialMovieYear = "",
  initialMovieFilterView = "categories",
  initialMoviePage = 1,
  initialSelectedMovieSlug = "",
  initialClientState = {},
  currentClient = {},
  initialSelectedChannelId = "",
}) {
  const hasInitialMovieBootstrap =
    (Array.isArray(initialMovies) && initialMovies.length > 0) ||
    (Array.isArray(initialMovieCategories) && initialMovieCategories.length > 0) ||
    (Array.isArray(initialContinueWatching) && initialContinueWatching.length > 0);
  const initialTheme = String(initialClientState?.theme || "").trim().toLowerCase();
  const [isDark, setIsDark] = useState(() => {
    if (initialTheme === "dark") return true;
    if (initialTheme === "light") return false;
    if (typeof window === "undefined") return true;
    try {
      const saved = window.localStorage.getItem("iptv:theme");
      if (saved === "dark") return true;
      if (saved === "light") return false;
    } catch {
      // ignore localStorage read issues
    }
    return document.documentElement.classList.contains("dark");
  });
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [showLeftSidebar, setShowLeftSidebar] = useState(false);
  const [showRightPanel, setShowRightPanel] = useState(false);
  const [channelSearch, setChannelSearch] = useState("");
  const [categorySearch, setCategorySearch] = useState("");
  const [homeMode, setHomeMode] = useState(() => {
    const forcedMode = String(initialHomeMode || "").trim().toLowerCase();
    if (forcedMode === "movies") return "movies";
    if (forcedMode === "tv") return "tv";
    if (String(initialSelectedChannelId || "").trim()) return "tv";
    if (typeof window === "undefined") return "tv";
    try {
      const savedMode = String(window.localStorage.getItem(LAST_MODE_KEY) || "").trim().toLowerCase();
      return savedMode === "movies" ? "movies" : "tv";
    } catch {
      return "tv";
    }
  });
  const [mode, setMode] = useState("all");
  const [movieMode, setMovieMode] = useState(() => {
    const seededMode = String(initialMovieMode || "").trim().toLowerCase();
    if (seededMode === "favorites" || seededMode === "recent" || seededMode === "watched") return seededMode;
    if (typeof window === "undefined") return "all";
    try {
      const raw = String(window.localStorage.getItem(LAST_MOVIE_FILTER_KEY) || "");
      const parsed = raw ? JSON.parse(raw) : {};
      const nextMode = String(parsed?.mode || "all").trim().toLowerCase();
      return nextMode === "favorites" || nextMode === "recent" || nextMode === "watched" ? nextMode : "all";
    } catch {
      return "all";
    }
  });
  const [selectedMovieCategory, setSelectedMovieCategory] = useState(() => {
    const seededCategory = String(initialMovieCategory || "").trim().toLowerCase();
    if (seededCategory) return seededCategory;
    if (typeof window === "undefined") return "";
    try {
      const raw = String(window.localStorage.getItem(LAST_MOVIE_FILTER_KEY) || "");
      const parsed = raw ? JSON.parse(raw) : {};
      return String(parsed?.category || "").trim().toLowerCase();
    } catch {
      return "";
    }
  });
  const [selectedMovieGenre, setSelectedMovieGenre] = useState(() => {
    const seededGenre = String(initialMovieGenre || "").trim().toLowerCase();
    if (seededGenre) return seededGenre;
    if (typeof window === "undefined") return "";
    try {
      const raw = String(window.localStorage.getItem(LAST_MOVIE_FILTER_KEY) || "");
      const parsed = raw ? JSON.parse(raw) : {};
      return String(parsed?.genre || "").trim().toLowerCase();
    } catch {
      return "";
    }
  });
  const [selectedMovieLanguage, setSelectedMovieLanguage] = useState(() => {
    const seededLanguage = String(initialMovieLanguage || "").trim().toLowerCase();
    if (seededLanguage) return seededLanguage;
    if (typeof window === "undefined") return "";
    try {
      const raw = String(window.localStorage.getItem(LAST_MOVIE_FILTER_KEY) || "");
      const parsed = raw ? JSON.parse(raw) : {};
      return String(parsed?.language || "").trim().toLowerCase();
    } catch {
      return "";
    }
  });
  const [selectedMovieYear, setSelectedMovieYear] = useState(() => {
    const seededYear = String(initialMovieYear || "").trim();
    if (seededYear) return seededYear;
    if (typeof window === "undefined") return "";
    try {
      const raw = String(window.localStorage.getItem(LAST_MOVIE_FILTER_KEY) || "");
      const parsed = raw ? JSON.parse(raw) : {};
      return String(parsed?.year || "").trim();
    } catch {
      return "";
    }
  });
  const [movieFilterView, setMovieFilterView] = useState(() => {
    const seededFilterView = String(initialMovieFilterView || "").trim().toLowerCase();
    if (seededFilterView === "genres") return "genres";
    if (seededFilterView === "categories") return "categories";
    if (typeof window === "undefined") return "categories";
    try {
      const raw = String(window.localStorage.getItem(LAST_MOVIE_FILTER_KEY) || "");
      const parsed = raw ? JSON.parse(raw) : {};
      return String(parsed?.filter_view || "").trim().toLowerCase() === "genres" ? "genres" : "categories";
    } catch {
      return "categories";
    }
  });
  const [movieSnapshot, setMovieSnapshot] = useState(() => (Array.isArray(initialMovies) ? initialMovies : []));
  const [movieCatalog, setMovieCatalog] = useState(() => ({
    movies: Array.isArray(initialMovies) ? initialMovies : [],
    categories: Array.isArray(initialMovieCategories) ? initialMovieCategories : [],
    genres: Array.isArray(initialMovieGenres) ? initialMovieGenres : [],
    languages: Array.isArray(initialMovieLanguages) ? initialMovieLanguages : [],
    years: Array.isArray(initialMovieYears) ? initialMovieYears : [],
    stats: initialMovieStats && typeof initialMovieStats === "object" ? initialMovieStats : {},
    continueWatching: Array.isArray(initialContinueWatching) ? initialContinueWatching : [],
    page: 1,
    pageSize: DEFAULT_MOVIES_PAGE_SIZE,
    total: Array.isArray(initialMovies) ? initialMovies.length : 0,
    totalPages: 1,
  }));
  const [movieCatalogStatus, setMovieCatalogStatus] = useState(() => (hasInitialMovieBootstrap ? "ready" : "idle"));
  const [moviePageLoading, setMoviePageLoading] = useState(false);
  const [routeStateReady, setRouteStateReady] = useState(() =>
    Boolean(String(initialHomeMode || "").trim()) || Boolean(String(initialSelectedMovieSlug || "").trim())
  );
  const [movieSidebarResetToken, setMovieSidebarResetToken] = useState(0);
  const [movieViewMode, setMovieViewMode] = useState(() => (moviesViewVariant === "watch" ? "watch" : "browse"));
  const [activeMovieSlug, setActiveMovieSlug] = useState(() => String(initialSelectedMovieSlug || "").trim().toLowerCase());
  const [movieListPage, setMovieListPage] = useState(() => Math.max(1, Number(initialMoviePage || readMoviePageFromUrl() || 1)));
  const [cookieConsent, setCookieConsent] = useState(() => {
    const v = String(initialClientState?.cookiePrefs?.consent || "").toLowerCase();
    return v === "accepted" || v === "declined" ? v : "unknown";
  });
  const [cookieLanguage, setCookieLanguage] = useState(() => {
    const v = String(initialClientState?.cookiePrefs?.language || "").toLowerCase();
    return v === "en" ? "en" : "bn";
  });
  const [favorites, setFavorites] = usePersistentArray(
    "favorites",
    Array.isArray(initialClientState?.favorites)
      ? initialClientState.favorites.map((id) => normalizeChannelId(id)).filter(Boolean)
      : [],
    { persist: false }
  );
  const [recent, setRecent] = usePersistentArray(
    "recent",
    Array.isArray(initialClientState?.recent)
      ? initialClientState.recent.map((id) => normalizeChannelId(id)).filter(Boolean)
      : [],
    { persist: cookieConsent === "accepted" }
  );
  const [isTvDevice, setIsTvDevice] = useState(false);
  const [forceTvMode, setForceTvMode] = useState(false);
  const [hasRestoredChannel, setHasRestoredChannel] = useState(false);
  const movieCatalogRequestRef = useRef(false);
  const lastLoadedMovieQueryRef = useRef("");
  const moviePageCacheRef = useRef(new Map());
  const moviePageRequestRef = useRef(new Map());
  const watchSessionRef = useRef({ channelId: "", channelName: "", startedAt: 0 });
  const deviceMeta = useMemo(() => {
    if (typeof window === "undefined") return {};
    let deviceKey = "";
    try {
      deviceKey = String(window.localStorage.getItem(DEVICE_KEY_STORAGE) || "").trim();
      if (!deviceKey) {
        const generated =
          (window.crypto?.randomUUID?.() || `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`)
            .replace(/-/g, "")
            .slice(0, 24);
        deviceKey = generated;
        window.localStorage.setItem(DEVICE_KEY_STORAGE, deviceKey);
      }
    } catch {
      deviceKey = "";
    }

    const tz = Intl?.DateTimeFormat?.().resolvedOptions?.().timeZone || "";
    const ua = String(window.navigator?.userAgent || "");
    const platform = String(window.navigator?.platform || "");
    const lang = String(window.navigator?.language || "");
    const w = Number(window.screen?.width || 0);
    const h = Number(window.screen?.height || 0);

    return {
      device_key: deviceKey,
      tz,
      lang,
      platform,
      ua,
      screen: w > 0 && h > 0 ? `${w}x${h}` : "",
    };
  }, []);

  useEffect(() => {
    const seededPage = Math.max(1, Number(initialMoviePage || readMoviePageFromUrl() || 1));
    const nextMovies = Array.isArray(initialMovies) ? initialMovies : [];
    const nextCategories = Array.isArray(initialMovieCategories) ? initialMovieCategories : [];
    const nextGenres = Array.isArray(initialMovieGenres) ? initialMovieGenres : [];
    const nextLanguages = Array.isArray(initialMovieLanguages) ? initialMovieLanguages : [];
    const nextYears = Array.isArray(initialMovieYears) ? initialMovieYears : [];
    const nextStats = initialMovieStats && typeof initialMovieStats === "object" ? initialMovieStats : {};
    const nextContinueWatching = Array.isArray(initialContinueWatching) ? initialContinueWatching : [];
    setMovieCatalog({
      movies: nextMovies,
      categories: nextCategories,
      genres: nextGenres,
      languages: nextLanguages,
      years: nextYears,
      stats: nextStats,
      continueWatching: nextContinueWatching,
      page: seededPage,
      pageSize: DEFAULT_MOVIES_PAGE_SIZE,
      total: nextMovies.length,
      totalPages: 1,
    });
    if (nextMovies.length) {
      const cacheKey = buildMoviePageCacheKey({
        page: seededPage,
        pageSize: DEFAULT_MOVIES_PAGE_SIZE,
        mode: initialMovieMode,
        category: initialMovieCategory,
        genre: initialMovieGenre,
        language: initialMovieLanguage,
        year: initialMovieYear,
      });
      moviePageCacheRef.current.set(cacheKey, {
        movies: nextMovies,
        page: seededPage,
        pageSize: DEFAULT_MOVIES_PAGE_SIZE,
        total: nextMovies.length,
        totalPages: 1,
      });
    }
    setMovieSnapshot(nextMovies);
    if (nextMovies.length || nextCategories.length || nextGenres.length || nextLanguages.length || nextYears.length || nextContinueWatching.length) {
      movieCatalogRequestRef.current = false;
      setMovieCatalogStatus("ready");
      setMoviePageLoading(false);
    }
  }, [initialMovieCategories, initialMovieGenre, initialMovieGenres, initialMovieLanguage, initialMovieLanguages, initialMovieMode, initialMovieCategory, initialMoviePage, initialMovieStats, initialMovieYear, initialMovieYears, initialMovies, initialContinueWatching]);

  const currentMovieRequestKey = useMemo(
    () =>
      buildMovieRequestKey({
        page: movieListPage,
        pageSize: movieCatalog.pageSize || DEFAULT_MOVIES_PAGE_SIZE,
        mode: movieMode,
        category: selectedMovieCategory,
        genre: selectedMovieGenre,
        language: selectedMovieLanguage,
        year: selectedMovieYear,
      }),
    [movieCatalog.pageSize, movieListPage, movieMode, selectedMovieCategory, selectedMovieGenre, selectedMovieLanguage, selectedMovieYear]
  );

  const ensureMovieCatalogLoaded = useCallback(() => {
    if (movieCatalogRequestRef.current || movieCatalogStatus === "ready") return;
    movieCatalogRequestRef.current = true;
    setMovieCatalogStatus("loading");
    const params = new URLSearchParams({
      page: String(Math.max(1, Number(movieListPage || 1))),
      pageSize: String(DEFAULT_MOVIES_PAGE_SIZE),
      mode: String(movieMode || "all"),
      category: String(selectedMovieCategory || ""),
      genre: String(selectedMovieGenre || ""),
      language: String(selectedMovieLanguage || ""),
      year: String(selectedMovieYear || ""),
    });
    fetch(`/api/client/movies/bootstrap?${params.toString()}`, {
      method: "GET",
      credentials: "same-origin",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Movie bootstrap failed with ${response.status}`);
        const payload = await response.json().catch(() => ({}));
        const nextMovies = Array.isArray(payload?.movies) ? payload.movies : [];
        const nextCategories = Array.isArray(payload?.categories) ? payload.categories : [];
        const nextGenres = Array.isArray(payload?.genres) ? payload.genres : [];
        const nextLanguages = Array.isArray(payload?.languages) ? payload.languages : [];
        const nextYears = Array.isArray(payload?.years) ? payload.years : [];
        const nextStats = payload?.stats && typeof payload.stats === "object" ? payload.stats : {};
        const nextContinueWatching = Array.isArray(payload?.continueWatching) ? payload.continueWatching : [];
        setMovieCatalog({
          movies: nextMovies,
          categories: nextCategories,
          genres: nextGenres,
          languages: nextLanguages,
          years: nextYears,
          stats: nextStats,
          continueWatching: nextContinueWatching,
          page: Number(payload?.page || 1),
          pageSize: Number(payload?.pageSize || DEFAULT_MOVIES_PAGE_SIZE),
          total: Number(payload?.total || nextMovies.length || 0),
          totalPages: Number(payload?.totalPages || 1),
        });
        setMovieSnapshot(nextMovies);
        setMovieCatalogStatus("ready");
        setMoviePageLoading(false);
        setMovieListPage(Number(payload?.page || 1));
        const loadedPage = Number(payload?.page || 1);
        const loadedPageSize = Number(payload?.pageSize || DEFAULT_MOVIES_PAGE_SIZE);
        moviePageCacheRef.current.set(
          buildMoviePageCacheKey({
            page: loadedPage,
            pageSize: loadedPageSize,
            mode: movieMode,
            category: selectedMovieCategory,
            genre: selectedMovieGenre,
            language: selectedMovieLanguage,
            year: selectedMovieYear,
          }),
          {
            movies: nextMovies,
            page: loadedPage,
            pageSize: loadedPageSize,
            total: Number(payload?.total || nextMovies.length || 0),
            totalPages: Number(payload?.totalPages || 1),
          }
        );
        lastLoadedMovieQueryRef.current = buildMovieRequestKey({
          page: loadedPage,
          pageSize: loadedPageSize,
          mode: movieMode,
          category: selectedMovieCategory,
          genre: selectedMovieGenre,
          language: selectedMovieLanguage,
          year: selectedMovieYear,
        });
      })
      .catch(() => {
        movieCatalogRequestRef.current = false;
        setMovieCatalogStatus("error");
        setMoviePageLoading(false);
      });
  }, [movieCatalogStatus, movieListPage, movieMode, selectedMovieCategory, selectedMovieGenre, selectedMovieLanguage, selectedMovieYear]);

  const loadMoviePage = useCallback(async (page, pageSize = DEFAULT_MOVIES_PAGE_SIZE, options = {}) => {
    const targetPage = Math.max(1, Number(page || 1));
    const normalizedQuery = {
      page: targetPage,
      pageSize,
      mode: movieMode,
      category: selectedMovieCategory,
      genre: selectedMovieGenre,
      language: selectedMovieLanguage,
      year: selectedMovieYear,
    };
    const cacheKey = buildMoviePageCacheKey(normalizedQuery);
    const cached = moviePageCacheRef.current.get(cacheKey);
    if (cached && options?.preferCache !== false) {
      setMovieCatalog((prev) => ({
        ...prev,
        movies: Array.isArray(cached.movies) ? cached.movies : [],
        page: Number(cached.page || targetPage),
        pageSize: Number(cached.pageSize || pageSize),
        total: Number(cached.total || 0),
        totalPages: Number(cached.totalPages || 1),
      }));
      setMovieSnapshot(Array.isArray(cached.movies) ? cached.movies : []);
      setMoviePageLoading(false);
      lastLoadedMovieQueryRef.current = buildMovieRequestKey(normalizedQuery);
      return cached;
    }

    if (!options?.background) setMoviePageLoading(true);

    const existingRequest = moviePageRequestRef.current.get(cacheKey);
    if (existingRequest) {
      const payload = await existingRequest.catch(() => null);
      if (payload && !options?.background) {
        const nextMovies = Array.isArray(payload?.movies) ? payload.movies : [];
        setMovieCatalog((prev) => ({
          ...prev,
          movies: nextMovies,
          page: Number(payload?.page || targetPage),
          pageSize: Number(payload?.pageSize || pageSize),
          total: Number(payload?.total || 0),
          totalPages: Number(payload?.totalPages || 1),
        }));
        setMovieSnapshot(nextMovies);
        setMoviePageLoading(false);
        lastLoadedMovieQueryRef.current = buildMovieRequestKey(normalizedQuery);
      }
      return payload;
    }

    const requestPromise = (async () => {
      try {
        const params = new URLSearchParams({
          page: String(targetPage),
          pageSize: String(pageSize),
          mode: String(movieMode || "all"),
          category: String(selectedMovieCategory || ""),
          genre: String(selectedMovieGenre || ""),
          language: String(selectedMovieLanguage || ""),
          year: String(selectedMovieYear || ""),
        });
        const response = await fetch(`/api/client/movies?${params.toString()}`, {
          method: "GET",
          credentials: "same-origin",
        });
        if (!response.ok) throw new Error(`Movie page failed with ${response.status}`);
        const payload = await response.json().catch(() => ({}));
        const nextMovies = Array.isArray(payload?.movies) ? payload.movies : [];
        const normalizedPayload = {
          movies: nextMovies,
          page: Number(payload?.page || targetPage),
          pageSize: Number(payload?.pageSize || pageSize),
          total: Number(payload?.total || 0),
          totalPages: Number(payload?.totalPages || 1),
        };
        moviePageCacheRef.current.set(cacheKey, normalizedPayload);
        return normalizedPayload;
      } finally {
        moviePageRequestRef.current.delete(cacheKey);
      }
    })();

    moviePageRequestRef.current.set(cacheKey, requestPromise);

    try {
      const payload = await requestPromise;
      if (!options?.background) {
        const nextMovies = Array.isArray(payload?.movies) ? payload.movies : [];
        setMovieCatalog((prev) => ({
          ...prev,
          movies: nextMovies,
          page: Number(payload?.page || targetPage),
          pageSize: Number(payload?.pageSize || pageSize),
          total: Number(payload?.total || 0),
          totalPages: Number(payload?.totalPages || 1),
        }));
        setMovieSnapshot(nextMovies);
        setMoviePageLoading(false);
      }
      lastLoadedMovieQueryRef.current = buildMovieRequestKey({
        page: Number(payload?.page || targetPage),
        pageSize: Number(payload?.pageSize || pageSize),
        mode: movieMode,
        category: selectedMovieCategory,
        genre: selectedMovieGenre,
        language: selectedMovieLanguage,
        year: selectedMovieYear,
      });
      return payload;
    } catch {
      if (!options?.background) setMoviePageLoading(false);
      return null;
    }
  }, [movieMode, selectedMovieCategory, selectedMovieGenre, selectedMovieLanguage, selectedMovieYear]);

  useEffect(() => {
    const shouldLoadMovies =
      homeMode === "movies" || moviesViewVariant === "watch" || Boolean(String(initialSelectedMovieSlug || "").trim());
    if (!routeStateReady || !shouldLoadMovies || movieCatalogStatus === "ready") return;
    ensureMovieCatalogLoaded();
  }, [ensureMovieCatalogLoaded, homeMode, initialSelectedMovieSlug, movieCatalogStatus, moviesViewVariant, routeStateReady]);

  useEffect(() => {
    if (homeMode !== "movies" || movieViewMode !== "browse") return;
    if (movieCatalogStatus !== "ready" || moviePageLoading) return;
    if (lastLoadedMovieQueryRef.current === currentMovieRequestKey) return;
    loadMoviePage(movieListPage, movieCatalog.pageSize || DEFAULT_MOVIES_PAGE_SIZE);
  }, [currentMovieRequestKey, homeMode, loadMoviePage, movieCatalog.pageSize, movieCatalogStatus, movieListPage, moviePageLoading, movieViewMode]);

  useEffect(() => {
    if (homeMode !== "movies" || movieViewMode !== "browse") return;
    if (movieCatalogStatus !== "ready" || moviePageLoading) return;
    const nextPage = Math.max(1, Number(movieCatalog.page || 1)) + 1;
    const totalPages = Math.max(1, Number(movieCatalog.totalPages || 1));
    if (nextPage > totalPages) return;
    loadMoviePage(nextPage, movieCatalog.pageSize || DEFAULT_MOVIES_PAGE_SIZE, { background: true });
  }, [homeMode, loadMoviePage, movieCatalog.page, movieCatalog.pageSize, movieCatalog.totalPages, movieCatalogStatus, moviePageLoading, movieViewMode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const path = String(window.location.pathname || "");
    const params = new URLSearchParams(window.location.search || "");
    const queryMode = String(params.get("mode") || "").toLowerCase();
    const queryMovieMode = String(params.get("movie_mode") || "").toLowerCase();
    const queryMovieCategory = String(params.get("movie_category") || "").trim().toLowerCase();
    const queryMovieGenre = String(params.get("movie_genre") || "").trim().toLowerCase();
    const queryMovieLanguage = String(params.get("movie_language") || "").trim().toLowerCase();
    const queryMovieFilterView = String(params.get("movie_filter_view") || "").trim().toLowerCase();
    const queryMovieYear = String(params.get("movie_year") || "").trim();
    const queryMoviePage = Math.max(1, Number.parseInt(String(params.get("movie_page") || "1"), 10) || 1);

    if (path.startsWith("/movie/")) {
      const slug = decodeURIComponent(path.replace(/^\/movie\//, "")).trim().toLowerCase();
      if (slug) {
        setHomeMode("movies");
        setMovieViewMode("watch");
        setActiveMovieSlug(slug);
      }
      setRouteStateReady(true);
      return;
    }

    if (queryMode === "movies") {
      setHomeMode("movies");
      setMovieViewMode("browse");
      setMovieListPage(queryMoviePage);
      setMovieMode(
        queryMovieMode === "favorites" || queryMovieMode === "recent" || queryMovieMode === "watched"
          ? queryMovieMode
          : "all"
      );
      setSelectedMovieCategory(queryMovieCategory);
      setSelectedMovieGenre(queryMovieGenre);
      setSelectedMovieLanguage(queryMovieLanguage);
      setSelectedMovieYear(queryMovieYear);
      setMovieFilterView(queryMovieFilterView === "genres" ? "genres" : "categories");
    }
    setRouteStateReady(true);
  }, []);

  const flushWatchHistory = useCallback((minimumSeconds = 5) => {
    const session = watchSessionRef.current;
    if (!session.channelId || !session.startedAt) return;

    const elapsedSeconds = Math.floor((Date.now() - session.startedAt) / 1000);
    if (elapsedSeconds < minimumSeconds) return;

    watchSessionRef.current = {
      ...session,
      startedAt: Date.now(),
    };

    fetch("/api/client/history", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        channel_id: session.channelId,
        channel_name: session.channelName,
        watch_seconds: elapsedSeconds,
      }),
      keepalive: true,
    }).catch(() => {});
  }, []);

  const trackActivity = (eventType, eventData) => {
    fetch("/api/client/activity", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        event_type: eventType,
        event_data: { ...(eventData || {}), ...deviceMeta },
      }),
    }).catch(() => {});
  };

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) root.classList.add("dark");
    else root.classList.remove("dark");
    try {
      window.localStorage.setItem("iptv:theme", isDark ? "dark" : "light");
    } catch {
      // ignore localStorage write issues
    }
  }, [isDark]);

  useEffect(() => {
    const ua = typeof navigator === "undefined" ? "" : navigator.userAgent.toLowerCase();
    const tvLike = /smart-tv|hbbtv|appletv|googletv|viera|tizen|web0s|netcast|silk|aft/.test(ua);
    setIsTvDevice(tvLike);
  }, []);

  const isTvMode = isTvDevice || forceTvMode;

  useEffect(() => {
    if (homeMode !== "tv") {
      flushWatchHistory(1);
      return;
    }

    const sendPing = () => {
      trackActivity("presence_ping", {
        route: homeMode === "movies" ? "home_movies" : "home_tv",
        channel_id: String(selectedChannel?.id || ""),
        channel_name: String(selectedChannel?.name || ""),
      });
    };
    sendPing();
    const timer = setInterval(sendPing, 30000);
    return () => clearInterval(timer);
  }, [selectedChannel?.id, selectedChannel?.name, homeMode, flushWatchHistory]);

  useEffect(() => {
    const nextChannelId = String(selectedChannel?.id || "").trim();
    const currentSession = watchSessionRef.current;

    if (currentSession.channelId && currentSession.channelId !== nextChannelId) {
      flushWatchHistory(1);
    }

    if (!nextChannelId) {
      watchSessionRef.current = { channelId: "", channelName: "", startedAt: 0 };
      return;
    }

    watchSessionRef.current = {
      channelId: nextChannelId,
      channelName: String(selectedChannel?.name || ""),
      startedAt: Date.now(),
    };
  }, [selectedChannel?.id, selectedChannel?.name, flushWatchHistory]);

  useEffect(() => {
    const intervalId = setInterval(() => flushWatchHistory(20), 45000);
    return () => clearInterval(intervalId);
  }, [flushWatchHistory]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") flushWatchHistory(1);
    };
    const onPageHide = () => flushWatchHistory(1);
    const onBeforeUnload = () => flushWatchHistory(1);

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("beforeunload", onBeforeUnload);
      flushWatchHistory(1);
    };
  }, [flushWatchHistory]);

  useEffect(() => {
    if (!isTvMode) return undefined;

    const emit = (name) => window.dispatchEvent(new CustomEvent(name));
    const onKeyDown = (event) => {
      const target = event.target;
      const isTyping =
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);

      const key = String(event.key || "");
      if (!isTyping && (key === "PageUp" || key === "ChannelUp")) {
        event.preventDefault();
        emit("tv-channel-next");
        return;
      }
      if (!isTyping && (key === "PageDown" || key === "ChannelDown")) {
        event.preventDefault();
        emit("tv-channel-prev");
        return;
      }
      if (!isTyping && key === "MediaPlayPause") {
        event.preventDefault();
        emit("tv-media-playpause");
        return;
      }
      if (!isTyping && key === "MediaPlay") {
        event.preventDefault();
        emit("tv-media-play");
        return;
      }
      if (!isTyping && key === "MediaPause") {
        event.preventDefault();
        emit("tv-media-pause");
        return;
      }
      if (!isTyping && key === "MediaStop") {
        event.preventDefault();
        emit("tv-media-stop");
        return;
      }
      if (key === "BrowserBack" || key === "GoBack") {
        event.preventDefault();
        emit("tv-back");
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isTvMode]);

  const allChannels = Array.isArray(initialChannels) ? initialChannels : [];
  const allCategories = Array.isArray(initialCategories) ? initialCategories : [];
  const routeSelectedChannelId = normalizeChannelId(initialSelectedChannelId);

  const categoriesWithCount = useMemo(() => {
    const countByCategoryId = new Map();
    for (const channel of allChannels) {
      const key = String(channel?.categoryId || toCategoryId(channel?.category)).trim();
      if (!key) continue;
      countByCategoryId.set(key, (countByCategoryId.get(key) || 0) + 1);
    }
    return allCategories.map((category) => ({
      ...category,
      count: Number(countByCategoryId.get(String(category.id || "")) || 0),
    }));
  }, [allChannels, allCategories]);

  useEffect(() => {
    if (hasRestoredChannel) return;
    if (homeMode !== "tv") {
      setHasRestoredChannel(true);
      return;
    }
    if (!allChannels.length) return;

    let restored = null;
    if (routeSelectedChannelId) {
      restored = allChannels.find((item) => normalizeChannelId(item?.id) === routeSelectedChannelId) || null;
    }

    if (!restored && cookieConsent === "accepted") {
      try {
        const seeded = String(initialClientState?.lastChannelId || "").trim();
        const savedId = seeded || String(window.localStorage.getItem(LAST_CHANNEL_KEY) || "").trim();
        if (savedId) {
          restored = allChannels.find((item) => String(item.id) === savedId) || null;
        }
      } catch {
        // ignore localStorage read issues
      }
    }

    if (restored) {
      setSelectedChannel(restored);
      setMode("all");
      setSelectedCategory(String(restored.categoryId || "").trim() || null);
      if (cookieConsent === "accepted") {
        setRecent((prev) => {
          const restoredId = normalizeChannelId(restored.id);
          const next = [restoredId, ...prev.filter((id) => normalizeChannelId(id) !== restoredId)];
          return next.slice(0, 30);
        });
      }
    }

    setHasRestoredChannel(true);
  }, [
    allChannels,
    cookieConsent,
    homeMode,
    hasRestoredChannel,
    initialClientState?.lastChannelId,
    routeSelectedChannelId,
    setRecent,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(LAST_MODE_KEY, homeMode === "movies" ? "movies" : "tv");
    } catch {
      // ignore localStorage write issues
    }
  }, [homeMode]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;
    const isMobile = window.innerWidth < 1024;
    const shouldLock = isMobile && (showLeftSidebar || showRightPanel);
    if (!shouldLock) return;

    const body = document.body;
    const html = document.documentElement;
    const prevBodyOverflow = body.style.overflow;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverscroll = body.style.overscrollBehavior;
    const prevHtmlOverscroll = html.style.overscrollBehavior;

    body.style.overflow = "hidden";
    html.style.overflow = "hidden";
    body.style.overscrollBehavior = "none";
    html.style.overscrollBehavior = "none";

    return () => {
      body.style.overflow = prevBodyOverflow;
      html.style.overflow = prevHtmlOverflow;
      body.style.overscrollBehavior = prevBodyOverscroll;
      html.style.overscrollBehavior = prevHtmlOverscroll;
    };
  }, [showLeftSidebar, showRightPanel]);

  const buildMovieListUrl = useCallback((nextMode, nextCategory, nextGenre, nextLanguage, nextYear, nextFilterView, nextPage = 1) => {
    const params = new URLSearchParams();
    params.set("mode", "movies");
    if (String(nextMode || "").toLowerCase() !== "all") params.set("movie_mode", String(nextMode || "").toLowerCase());
    if (String(nextCategory || "").trim()) params.set("movie_category", String(nextCategory || "").trim().toLowerCase());
    if (String(nextGenre || "").trim()) params.set("movie_genre", String(nextGenre || "").trim().toLowerCase());
    if (String(nextLanguage || "").trim()) params.set("movie_language", String(nextLanguage || "").trim().toLowerCase());
    if (String(nextYear || "").trim()) params.set("movie_year", String(nextYear || "").trim());
    if (String(nextFilterView || "").trim().toLowerCase() === "genres") params.set("movie_filter_view", "genres");
    if (Math.max(1, Number(nextPage || 1)) > 1) params.set("movie_page", String(Math.max(1, Number(nextPage || 1))));
    const qs = params.toString();
    return qs ? `/?${qs}` : "/";
  }, []);

  const pushMovieListUrl = useCallback(
    (nextMode, nextCategory, nextGenre, nextLanguage, nextYear, nextFilterView, nextPage = 1) => {
      if (typeof window === "undefined") return;
      const next = buildMovieListUrl(nextMode, nextCategory, nextGenre, nextLanguage, nextYear, nextFilterView, nextPage);
      if (window.location.pathname + window.location.search !== next) {
        window.history.pushState(window.history.state, "", next);
      }
    },
    [buildMovieListUrl]
  );

  const pushMovieWatchUrl = useCallback((slug) => {
    if (typeof window === "undefined") return;
    const normalizedSlug = String(slug || "").trim().toLowerCase();
    if (!normalizedSlug) return;
    const next = `/movie/${encodeURIComponent(normalizedSlug)}`;
    if (window.location.pathname !== next) {
      window.history.pushState(window.history.state, "", next);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (homeMode !== "movies" || movieViewMode !== "browse") return;
    if (String(window.location.pathname || "").startsWith("/movie/")) return;
    pushMovieListUrl(
      movieMode,
      selectedMovieCategory,
      selectedMovieGenre,
      selectedMovieLanguage,
      selectedMovieYear,
      movieFilterView,
      movieListPage
    );
  }, [homeMode, movieListPage, movieViewMode, movieMode, selectedMovieCategory, selectedMovieGenre, selectedMovieLanguage, selectedMovieYear, movieFilterView, pushMovieListUrl]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const payload = {
      mode: String(movieMode || "all").toLowerCase(),
      category: String(selectedMovieCategory || "").toLowerCase(),
      genre: String(selectedMovieGenre || "").toLowerCase(),
      language: String(selectedMovieLanguage || "").toLowerCase(),
      year: String(selectedMovieYear || "").trim(),
      filter_view: movieFilterView === "genres" ? "genres" : "categories",
    };
    try {
      window.localStorage.setItem(LAST_MOVIE_FILTER_KEY, JSON.stringify(payload));
    } catch {
      // ignore localStorage write issues
    }
  }, [movieMode, selectedMovieCategory, selectedMovieGenre, selectedMovieLanguage, selectedMovieYear, movieFilterView]);

  useEffect(() => {
    if (cookieConsent !== "accepted") return;
    const id = String(selectedChannel?.id || "").trim();
    if (!id) return;
    try {
      window.localStorage.setItem(LAST_CHANNEL_KEY, id);
    } catch {
      // ignore localStorage write issues
    }
  }, [selectedChannel, cookieConsent]);

  useEffect(() => {
    if (cookieConsent === "accepted") return;
    setRecent([]);
    try {
      window.localStorage.removeItem(LAST_CHANNEL_KEY);
    } catch {
      // ignore localStorage write issues
    }
  }, [cookieConsent, setRecent]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const selectedId = normalizeChannelId(selectedChannel?.id);
    if (!selectedId) return;

    const nextPath = buildWatchPath({ id: selectedId, name: selectedChannel?.name || "" });
    if (!nextPath || window.location.pathname === nextPath) return;
    window.history.replaceState(window.history.state, "", nextPath);
  }, [selectedChannel?.id, selectedChannel?.name]);

  useEffect(() => {
    if (!hasRestoredChannel && cookieConsent === "accepted") return;
    const payload = {
      favorites,
      recent: cookieConsent === "accepted" ? recent : [],
      last_channel_id: cookieConsent === "accepted" ? String(selectedChannel?.id || "") : "",
      theme: isDark ? "dark" : "light",
      cookie_prefs: {
        consent: cookieConsent,
        language: cookieLanguage,
      },
    };
    const timer = setTimeout(() => {
      fetch("/api/client/state", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      }).catch(() => {});
    }, 550);
    return () => clearTimeout(timer);
  }, [favorites, recent, selectedChannel?.id, isDark, hasRestoredChannel, cookieConsent, cookieLanguage]);

  const recentSet = useMemo(() => new Set(recent), [recent]);
  const liveCount = useMemo(() => allChannels.filter((item) => item.isLive).length, [allChannels]);
  const tvStats = useMemo(() => {
    return {
      all: allChannels.length,
      favorites: allChannels.filter((channel) => favorites.includes(normalizeChannelId(channel?.id))).length,
      recent: allChannels.filter((channel) => recentSet.has(normalizeChannelId(channel?.id))).length,
    };
  }, [allChannels, favorites, recentSet]);
  const movieStats = useMemo(() => {
    return {
      all: Number(movieCatalog?.stats?.all || 0),
      favorites: Number(movieCatalog?.stats?.favorites || 0),
      recent: Number(movieCatalog?.stats?.recent || 0),
      watched: Number(movieCatalog?.stats?.watched || 0),
    };
  }, [movieCatalog?.stats]);
  const movieCategoriesWithCount = useMemo(() => {
    return (Array.isArray(movieCatalog.categories) ? movieCatalog.categories : []).map((category) => {
      const slug = String(category?.slug || "").trim().toLowerCase();
      return {
        ...category,
        slug,
        count: Number(category?.count || 0),
      };
    });
  }, [movieCatalog.categories]);
  const movieGenresWithCount = useMemo(
    () => (Array.isArray(movieCatalog.genres) ? movieCatalog.genres : []),
    [movieCatalog.genres]
  );
  const movieLanguagesWithCount = useMemo(
    () => (Array.isArray(movieCatalog.languages) ? movieCatalog.languages : []),
    [movieCatalog.languages]
  );
  const movieYearsWithCount = useMemo(
    () => (Array.isArray(movieCatalog.years) ? movieCatalog.years : []),
    [movieCatalog.years]
  );

  const visibleChannels = useMemo(() => {
    let list = allChannels;

    if (mode === "favorites") {
      const favoriteSet = new Set(favorites);
      list = list.filter((channel) => favoriteSet.has(normalizeChannelId(channel.id)));
    }

    if (mode === "recent") {
      list = list.filter((channel) => recentSet.has(normalizeChannelId(channel.id)));
      const recentOrder = new Map(recent.map((id, index) => [id, index]));
      list = list
        .slice()
        .sort(
          (a, b) =>
            (recentOrder.get(normalizeChannelId(a.id)) ?? 9999) -
            (recentOrder.get(normalizeChannelId(b.id)) ?? 9999)
        );
    }

    if (selectedCategory && mode === "all") {
      const selected = String(selectedCategory || "");
      list = list.filter((channel) => {
        const channelCategoryId = String(channel?.categoryId || "").trim();
        if (channelCategoryId) return channelCategoryId === selected;
        return toCategoryId(channel.category) === selected;
      });
    }

    const query = channelSearch.trim().toLowerCase();
    if (query) {
      list = list.filter((channel) => String(channel.name || "").toLowerCase().includes(query));
    }

    return list;
  }, [allChannels, mode, favorites, selectedCategory, channelSearch, recent, recentSet]);

  const toggleFavorite = (channelId) => {
    const key = normalizeChannelId(channelId);
    setFavorites((prev) => {
      const has = prev.some((id) => normalizeChannelId(id) === key);
      return has ? prev.filter((id) => normalizeChannelId(id) !== key) : [...prev, key];
    });
    trackActivity("favorite_toggle", { channel_id: channelId });
  };

  const selectedIndex = useMemo(() => {
    if (!selectedChannel?.id) return -1;
    const selectedId = normalizeChannelId(selectedChannel.id);
    return visibleChannels.findIndex((item) => normalizeChannelId(item.id) === selectedId);
  }, [visibleChannels, selectedChannel]);

  const handleSelectChannel = (channel) => {
    setHomeMode("tv");
    setSelectedChannel(channel);
    if (cookieConsent === "accepted") {
      setRecent((prev) => {
        const channelId = normalizeChannelId(channel.id);
        const next = [channelId, ...prev.filter((id) => normalizeChannelId(id) !== channelId)];
        return next.slice(0, 30);
      });
    }
    if (window.innerWidth < 1024) setShowRightPanel(false);
    trackActivity("channel_select", { channel_id: channel.id, channel_name: channel.name || "" });
  };

  const handleChannelStep = (step) => {
    const total = visibleChannels.length;
    if (!total) return;

    if (selectedIndex < 0) {
      const fallback = step >= 0 ? visibleChannels[0] : visibleChannels[total - 1];
      handleSelectChannel(fallback);
      return;
    }

    const nextIndex = (selectedIndex + step + total) % total;
    handleSelectChannel(visibleChannels[nextIndex]);
  };

  const handleFullscreenCategorySelect = (categoryId) => {
    setMode("all");
    setSelectedCategory(categoryId);
  };

  const handleSidebarModeSelect = (nextMode) => {
    setMode(nextMode);
  };

  const clearMovieSidebarFilters = ({
    category = "",
    genre = "",
    language = "",
    year = "",
    mode = "all",
    filterView = "categories",
  } = {}) => {
    setMovieSidebarResetToken((prev) => prev + 1);
    setMovieMode(mode);
    setSelectedMovieCategory(String(category || "").trim().toLowerCase());
    setSelectedMovieGenre(String(genre || "").trim().toLowerCase());
    setSelectedMovieLanguage(String(language || "").trim().toLowerCase());
    setSelectedMovieYear(String(year || "").trim());
    setMovieFilterView(filterView);
    return {
      mode,
      category: String(category || "").trim().toLowerCase(),
      genre: String(genre || "").trim().toLowerCase(),
      language: String(language || "").trim().toLowerCase(),
      year: String(year || "").trim(),
      filterView,
    };
  };

  const handleSidebarMovieModeSelect = (nextMode) => {
    setHomeMode("movies");
    setMovieViewMode("browse");
    setMovieListPage(1);
    const modeKey = String(nextMode || "all").trim().toLowerCase();
    const next = clearMovieSidebarFilters({
      mode: modeKey === "favorites" || modeKey === "recent" || modeKey === "watched" ? modeKey : "all",
      category: "",
      genre: "",
      language: "",
      year: "",
      filterView: "categories",
    });
    pushMovieListUrl(next.mode, next.category, next.genre, next.language, next.year, next.filterView, 1);
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setShowLeftSidebar(false);
    }
  };

  const handleToggleLeftSidebar = () => {
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setShowLeftSidebar((prev) => {
        const next = !prev;
        if (next) setShowRightPanel(false);
        return next;
      });
      return;
    }
    setShowLeftSidebar((prev) => !prev);
  };

  const handleToggleRightPanel = () => {
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setShowRightPanel((prev) => {
        const next = !prev;
        if (next) setShowLeftSidebar(false);
        return next;
      });
      return;
    }
    setShowRightPanel((prev) => !prev);
  };

  const handleSidebarCategorySelect = (categoryId) => {
    setSelectedCategory(categoryId);
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setShowLeftSidebar(false);
      setShowRightPanel(true);
    }
  };
  const handleSidebarMovieCategorySelect = (categorySlug) => {
    const nextCategory = String(categorySlug || "").trim().toLowerCase();
    setHomeMode("movies");
    setMovieViewMode("browse");
    setMovieListPage(1);
    const next = clearMovieSidebarFilters({
      mode: "all",
      category: nextCategory,
      genre: "",
      language: "",
      year: "",
      filterView: "categories",
    });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("movie-force-pause"));
    }
    pushMovieListUrl(next.mode, next.category, next.genre, next.language, next.year, next.filterView, 1);
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setShowLeftSidebar(false);
    }
  };
  const handleSidebarMovieGenreSelect = (genreKey) => {
    const nextGenre = String(genreKey || "").trim().toLowerCase();
    setHomeMode("movies");
    setMovieViewMode("browse");
    setMovieListPage(1);
    const next = clearMovieSidebarFilters({
      mode: "all",
      category: "",
      genre: nextGenre,
      language: "",
      year: "",
      filterView: "genres",
    });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("movie-force-pause"));
    }
    pushMovieListUrl(next.mode, next.category, next.genre, next.language, next.year, next.filterView, 1);
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setShowLeftSidebar(false);
    }
  };
  const handleSidebarMovieLanguageSelect = (languageKey) => {
    const nextLanguage = String(languageKey || "").trim().toLowerCase();
    setHomeMode("movies");
    setMovieViewMode("browse");
    setMovieListPage(1);
    const next = clearMovieSidebarFilters({
      mode: "all",
      category: "",
      genre: "",
      language: nextLanguage,
      year: "",
      filterView: "genres",
    });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("movie-force-pause"));
    }
    pushMovieListUrl(next.mode, next.category, next.genre, next.language, next.year, next.filterView, 1);
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setShowLeftSidebar(false);
    }
  };
  const handleSidebarMovieYearSelect = (yearValue) => {
    const nextYear = String(yearValue || "").trim();
    setHomeMode("movies");
    setMovieViewMode("browse");
    setMovieListPage(1);
    const next = clearMovieSidebarFilters({
      mode: "all",
      category: "",
      genre: "",
      language: "",
      year: nextYear,
      filterView: "genres",
    });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("movie-force-pause"));
    }
    pushMovieListUrl(next.mode, next.category, next.genre, next.language, next.year, next.filterView, 1);
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setShowLeftSidebar(false);
    }
  };

  const debugStats = useMemo(
    () => ({
      total: allChannels.length,
      live: liveCount,
      home: visibleChannels.length,
      categories: allCategories.length,
    }),
    [allChannels.length, allCategories.length, liveCount, visibleChannels.length]
  );

  return (
    <main className={`${styles.pageWrap} ${isDark ? styles.pageDark : styles.pageLight}`}>
      <TopNavbar
        isDark={isDark}
        isTvMode={isTvMode}
        showChannelMenu={homeMode === "tv"}
        onToggleTheme={() => {
          setIsDark((prev) => !prev);
          trackActivity("theme_change", { to: isDark ? "light" : "dark" });
        }}
        onToggleTvMode={() => setForceTvMode((prev) => !prev)}
        onToggleLeftSidebar={handleToggleLeftSidebar}
        onToggleRightPanel={handleToggleRightPanel}
        onProfileIconClick={() => {
          setShowLeftSidebar(false);
          setShowRightPanel(false);
        }}
        debugStats={debugStats}
        clientLabel={currentClient?.fullName || currentClient?.email || "Client"}
        clientProfile={currentClient}
        language={cookieLanguage}
      />
      <section className={styles.contentWrap}>
        <div className={`${styles.drawerLeft} ${showLeftSidebar ? styles.drawerLeftOpen : ""}`}>
          <LeftSidebar
            categories={categoriesWithCount}
            movieCategories={movieCategoriesWithCount}
            movieGenres={movieGenresWithCount}
            movieLanguages={movieLanguagesWithCount}
            movieYears={movieYearsWithCount}
            selectedCategory={selectedCategory}
            selectedMovieCategory={selectedMovieCategory}
            selectedMovieGenre={selectedMovieGenre}
            selectedMovieLanguage={selectedMovieLanguage}
            selectedMovieYear={selectedMovieYear}
            mode={mode}
            movieMode={movieMode}
            tvStats={tvStats}
            movieFilterView={movieFilterView}
            movieStats={movieStats}
            homeMode={homeMode}
            onSelectHomeMode={(nextMode) => {
              const normalized = nextMode === "movies" ? "movies" : "tv";
              setHomeMode(normalized);
              if (normalized === "movies") setMovieViewMode("browse");
              if (typeof window !== "undefined" && window.innerWidth < 1024) {
                if (normalized === "tv" || normalized === "movies") {
                  // On mobile keep category drawer open until user selects a category.
                  setShowLeftSidebar(true);
                  setShowRightPanel(false);
                } else {
                  setShowLeftSidebar(false);
                  setShowRightPanel(false);
                }
              }
              if (normalized === "movies") {
                pushMovieListUrl(
                  movieMode,
                  selectedMovieCategory,
                  selectedMovieGenre,
                  selectedMovieLanguage,
                  selectedMovieYear,
                  movieFilterView,
                  movieListPage
                );
              }
              trackActivity("module_switch", { to: normalized });
            }}
            onSelectCategory={handleSidebarCategorySelect}
            onSelectMode={handleSidebarModeSelect}
            onSelectMovieCategory={handleSidebarMovieCategorySelect}
            onSelectMovieGenre={handleSidebarMovieGenreSelect}
            onSelectMovieLanguage={handleSidebarMovieLanguageSelect}
            onSelectMovieYear={handleSidebarMovieYearSelect}
            onSelectMovieFilterView={setMovieFilterView}
            onSelectMovieMode={handleSidebarMovieModeSelect}
            isDark={isDark}
            onClose={() => setShowLeftSidebar(false)}
            search={categorySearch}
            onSearch={setCategorySearch}
          />
        </div>

        {(showLeftSidebar || showRightPanel) && (
          <button
            type="button"
            className={styles.mobileOverlay}
            onClick={() => {
              setShowLeftSidebar(false);
              setShowRightPanel(false);
            }}
            aria-label="Close side panels"
          />
        )}

        <section className={styles.centerCol}>
          {homeMode === "tv" ? (
            <>
              <VideoPlayer
                channel={selectedChannel}
                isDark={isDark}
                isFavorite={selectedChannel ? favorites.includes(normalizeChannelId(selectedChannel.id)) : false}
                onToggleFavorite={toggleFavorite}
                favorites={favorites}
                onPrevChannel={() => handleChannelStep(-1)}
                onNextChannel={() => handleChannelStep(1)}
                hasChannelNav={visibleChannels.length > 1}
                isTvMode={isTvMode}
                categories={allCategories}
                channels={visibleChannels}
                selectedCategory={selectedCategory}
                onSelectCategory={handleFullscreenCategorySelect}
                onSelectChannel={handleSelectChannel}
                onPlaybackAttempt={(payload) => {
                  trackActivity("playback_attempt", payload || {});
                }}
                onPlaybackFailure={(payload) => {
                  trackActivity("playback_failed", payload || {});
                }}
              />
              <div className={`${styles.debugBadge} ${styles.debugBadgeMobile}`}>
                <strong>Debug</strong>
                <span>links: {debugStats.total}</span>
                <span>live: {debugStats.live}</span>
                <span>home: {debugStats.home}</span>
                <span>categories: {debugStats.categories}</span>
              </div>
            </>
          ) : (
            movieCatalogStatus !== "ready" ? (
              <section
                aria-live="polite"
                style={{ minHeight: "40dvh", display: "grid", placeItems: "center", padding: "24px" }}
              >
                <p style={{ margin: 0, color: "var(--muted-foreground)" }}>
                  {movieCatalogStatus === "error" ? "Movies failed to load. Please try again." : "Loading movies..."}
                </p>
              </section>
            ) : (
              <MoviesView
                variant={movieViewMode}
                externalFilterResetToken={movieSidebarResetToken}
                initialMovies={movieCatalog.movies}
                movieCategories={movieCatalog.categories}
                initialContinueWatching={movieCatalog.continueWatching}
                initialPage={movieCatalog.page}
                initialPageSize={movieCatalog.pageSize}
                totalMovies={movieCatalog.total}
                totalMoviePages={movieCatalog.totalPages}
                isPageLoading={moviePageLoading}
                onPageChange={(page, pageSize) => {
                  const nextPage = Math.max(1, Number(page || 1));
                  setMovieListPage(nextPage);
                  loadMoviePage(nextPage, pageSize);
                  pushMovieListUrl(
                    movieMode,
                    selectedMovieCategory,
                    selectedMovieGenre,
                    selectedMovieLanguage,
                    selectedMovieYear,
                    movieFilterView,
                    nextPage
                  );
                }}
                initialSelectedMovieSlug={activeMovieSlug || initialSelectedMovieSlug}
                filterMode={movieMode}
                filterCategorySlug={selectedMovieCategory}
                filterGenreSlug={selectedMovieGenre}
                filterLanguageSlug={selectedMovieLanguage}
                filterYear={selectedMovieYear}
                genreOptions={movieGenresWithCount}
                languageOptions={movieLanguagesWithCount}
                yearOptions={movieYearsWithCount}
                onSelectGenreFilter={(genreKey) => {
                  const nextGenre = String(genreKey || "").trim().toLowerCase();
                  setMovieFilterView("genres");
                  setMovieMode("all");
                  setSelectedMovieGenre(nextGenre);
                  setMovieListPage(1);
                  pushMovieListUrl("all", selectedMovieCategory, nextGenre, selectedMovieLanguage, selectedMovieYear, "genres", 1);
                }}
                onSelectLanguageFilter={(languageKey) => {
                  const nextLanguage = String(languageKey || "").trim().toLowerCase();
                  setMovieFilterView("genres");
                  setMovieMode("all");
                  setSelectedMovieLanguage(nextLanguage);
                  setMovieListPage(1);
                  pushMovieListUrl("all", selectedMovieCategory, selectedMovieGenre, nextLanguage, selectedMovieYear, "genres", 1);
                }}
                onSelectYearFilter={(yearValue) => {
                  const nextYear = String(yearValue || "").trim();
                  setMovieFilterView("genres");
                  setMovieMode("all");
                  setSelectedMovieYear(nextYear);
                  setMovieListPage(1);
                  pushMovieListUrl("all", selectedMovieCategory, selectedMovieGenre, selectedMovieLanguage, nextYear, "genres", 1);
                }}
                onSelectCategoryFilter={(categoryValue) => {
                  const nextCategory = String(categoryValue || "").trim().toLowerCase();
                  setMovieMode("all");
                  setSelectedMovieCategory(nextCategory);
                  setMovieListPage(1);
                  pushMovieListUrl("all", nextCategory, selectedMovieGenre, selectedMovieLanguage, selectedMovieYear, movieFilterView, 1);
                }}
                onSelectModeFilter={(nextMode) => {
                  const modeKey = String(nextMode || "all").trim().toLowerCase();
                  setMovieMode(
                    modeKey === "favorites" || modeKey === "recent" || modeKey === "watched" ? modeKey : "all"
                  );
                  setMovieListPage(1);
                  pushMovieListUrl(modeKey, selectedMovieCategory, selectedMovieGenre, selectedMovieLanguage, selectedMovieYear, movieFilterView, 1);
                }}
                onResetFilters={() => {
                  setMovieMode("all");
                  setSelectedMovieCategory("");
                  setSelectedMovieGenre("");
                  setSelectedMovieLanguage("");
                  setSelectedMovieYear("");
                  setMovieFilterView("categories");
                  setMovieListPage(1);
                  pushMovieListUrl("all", "", "", "", "", "categories", 1);
                }}
                showInlineFilters={false}
                onOpenMovieWatch={(slug) => {
                  const normalizedSlug = String(slug || "").trim().toLowerCase();
                  if (!normalizedSlug) return;
                  setHomeMode("movies");
                  setMovieViewMode("watch");
                  setActiveMovieSlug(normalizedSlug);
                  pushMovieWatchUrl(normalizedSlug);
                }}
                onBackToMovieList={() => {
                  setHomeMode("movies");
                  setMovieViewMode("browse");
                  const returnPage = Math.max(1, Number(movieListPage || 1));
                  setMovieListPage(returnPage);
                  loadMoviePage(returnPage, movieCatalog.pageSize || DEFAULT_MOVIES_PAGE_SIZE);
                  pushMovieListUrl(
                    movieMode,
                    selectedMovieCategory,
                    selectedMovieGenre,
                    selectedMovieLanguage,
                    selectedMovieYear,
                    movieFilterView,
                    returnPage
                  );
                }}
                onMoviesSnapshotChange={setMovieSnapshot}
                onTrackActivity={trackActivity}
              />
            )
          )}
        </section>

        {homeMode === "tv" ? (
          <div className={`${styles.drawerRight} ${showRightPanel ? styles.drawerRightOpen : ""}`}>
            <RightPanel
              channels={visibleChannels}
              selectedChannel={selectedChannel}
              onChannelSelect={handleSelectChannel}
              search={channelSearch}
              onSearch={setChannelSearch}
              isDark={isDark}
              onClose={() => setShowRightPanel(false)}
              favorites={favorites}
              onToggleFavorite={toggleFavorite}
            />
          </div>
        ) : null}
      </section>
      <CookieConsentBanner
        consent={cookieConsent}
        language={cookieLanguage}
        onToggleLanguage={() => setCookieLanguage((prev) => (prev === "en" ? "bn" : "en"))}
        onAllow={() => {
          setCookieConsent("accepted");
          trackActivity("cookie_consent", { consent: "accepted" });
        }}
        onDecline={() => {
          setCookieConsent("declined");
          trackActivity("cookie_consent", { consent: "declined" });
        }}
      />
    </main>
  );
}
