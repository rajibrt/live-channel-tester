"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import LeftSidebar from "./LeftSidebar";
import RightPanel from "./RightPanel";
import TopNavbar from "./TopNavbar";
import VideoPlayer from "./VideoPlayer";
import CookieConsentBanner from "./CookieConsentBanner";
import styles from "./iptv.module.css";
import { usePersistentArray } from "./usePersistentArray";
import { buildWatchPath } from "../../lib/channelSlug";
import MoviesView from "../movies/MoviesView";

const LAST_CHANNEL_KEY = "iptv:v1:last-channel-id";
const LAST_MODE_KEY = "iptv:v1:last-mode";
const LAST_MOVIE_FILTER_KEY = "iptv:v1:last-movie-filter";
const DEVICE_KEY_STORAGE = "iptv:v1:device-key";

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

export default function IptvHomeClient({
  initialChannels = [],
  initialCategories = [],
  initialMovies = [],
  initialMovieCategories = [],
  initialContinueWatching = [],
  moviesViewVariant = "browse",
  initialHomeMode = "",
  initialSelectedMovieSlug = "",
  initialClientState = {},
  currentClient = {},
  initialSelectedChannelId = "",
}) {
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
    if (typeof window === "undefined") return "categories";
    try {
      const raw = String(window.localStorage.getItem(LAST_MOVIE_FILTER_KEY) || "");
      const parsed = raw ? JSON.parse(raw) : {};
      return String(parsed?.filter_view || "").trim().toLowerCase() === "genres" ? "genres" : "categories";
    } catch {
      return "categories";
    }
  });
  const [movieSidebarResetToken, setMovieSidebarResetToken] = useState(0);
  const [movieViewMode, setMovieViewMode] = useState(() => (moviesViewVariant === "watch" ? "watch" : "browse"));
  const [activeMovieSlug, setActiveMovieSlug] = useState(() => String(initialSelectedMovieSlug || "").trim().toLowerCase());
  const [cookieConsent, setCookieConsent] = useState(() => {
    const v = String(initialClientState?.cookiePrefs?.consent || "").toLowerCase();
    return v === "accepted" || v === "declined" ? v : "unknown";
  });
  const [cookieLanguage, setCookieLanguage] = useState(() => {
    const v = String(initialClientState?.cookiePrefs?.language || "").toLowerCase();
    return v === "bn" ? "bn" : "en";
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

    if (path.startsWith("/movie/")) {
      const slug = decodeURIComponent(path.replace(/^\/movie\//, "")).trim().toLowerCase();
      if (slug) {
        setHomeMode("movies");
        setMovieViewMode("watch");
        setActiveMovieSlug(slug);
      }
      return;
    }

    if (queryMode === "movies") {
      setHomeMode("movies");
      setMovieViewMode("browse");
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

  const buildMovieListUrl = useCallback((nextMode, nextCategory, nextGenre, nextLanguage, nextYear, nextFilterView) => {
    const params = new URLSearchParams();
    params.set("mode", "movies");
    if (String(nextMode || "").toLowerCase() !== "all") params.set("movie_mode", String(nextMode || "").toLowerCase());
    if (String(nextCategory || "").trim()) params.set("movie_category", String(nextCategory || "").trim().toLowerCase());
    if (String(nextGenre || "").trim()) params.set("movie_genre", String(nextGenre || "").trim().toLowerCase());
    if (String(nextLanguage || "").trim()) params.set("movie_language", String(nextLanguage || "").trim().toLowerCase());
    if (String(nextYear || "").trim()) params.set("movie_year", String(nextYear || "").trim());
    if (String(nextFilterView || "").trim().toLowerCase() === "genres") params.set("movie_filter_view", "genres");
    const qs = params.toString();
    return qs ? `/?${qs}` : "/";
  }, []);

  const pushMovieListUrl = useCallback(
    (nextMode, nextCategory, nextGenre, nextLanguage, nextYear, nextFilterView) => {
      if (typeof window === "undefined") return;
      const next = buildMovieListUrl(nextMode, nextCategory, nextGenre, nextLanguage, nextYear, nextFilterView);
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
    pushMovieListUrl(movieMode, selectedMovieCategory, selectedMovieGenre, selectedMovieLanguage, selectedMovieYear, movieFilterView);
  }, [homeMode, movieViewMode, movieMode, selectedMovieCategory, selectedMovieGenre, selectedMovieLanguage, selectedMovieYear, movieFilterView, pushMovieListUrl]);

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
  const movieStats = useMemo(() => {
    const list = Array.isArray(initialMovies) ? initialMovies : [];
    return {
      all: list.length,
      favorites: list.filter((movie) => Boolean(movie?.isFavorite)).length,
      recent: list.filter((movie) => Number(movie?.progress?.positionSeconds || 0) > 0).length,
      watched: list.filter((movie) => String(movie?.watchState || "") === "watched").length,
    };
  }, [initialMovies]);
  const movieCategoriesWithCount = useMemo(() => {
    const list = Array.isArray(initialMovies) ? initialMovies : [];
    const counts = new Map();
    for (const movie of list) {
      const slugs = Array.isArray(movie?.categorySlugs) ? movie.categorySlugs : [];
      for (const slug of slugs) {
        const key = String(slug || "").trim().toLowerCase();
        if (!key) continue;
        counts.set(key, (counts.get(key) || 0) + 1);
      }
    }
    return (Array.isArray(initialMovieCategories) ? initialMovieCategories : []).map((category) => {
      const slug = String(category?.slug || "").trim().toLowerCase();
      return {
        ...category,
        slug,
        count: Number(counts.get(slug) || 0),
      };
    });
  }, [initialMovieCategories, initialMovies]);
  const movieGenresWithCount = useMemo(() => {
    const list = Array.isArray(initialMovies) ? initialMovies : [];
    const byKey = new Map();
    for (const movie of list) {
      const genres = Array.isArray(movie?.imdbGenres) ? movie.imdbGenres : [];
      for (const rawGenre of genres) {
        const name = String(rawGenre || "").trim();
        const key = name.toLowerCase();
        if (!key) continue;
        if (byKey.has(key)) {
          byKey.get(key).count += 1;
        } else {
          byKey.set(key, { key, name, count: 1 });
        }
      }
    }
    return Array.from(byKey.values()).sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  }, [initialMovies]);
  const movieLanguagesWithCount = useMemo(() => {
    const list = Array.isArray(initialMovies) ? initialMovies : [];
    const byKey = new Map();
    for (const movie of list) {
      const languages = Array.isArray(movie?.imdbLanguages) ? movie.imdbLanguages : [];
      for (const rawLanguage of languages) {
        const name = String(rawLanguage || "").trim();
        const key = name.toLowerCase();
        if (!key) continue;
        if (byKey.has(key)) {
          byKey.get(key).count += 1;
        } else {
          byKey.set(key, { key, name, count: 1 });
        }
      }
    }
    return Array.from(byKey.values()).sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  }, [initialMovies]);
  const movieYearsWithCount = useMemo(() => {
    const list = Array.isArray(initialMovies) ? initialMovies : [];
    const byYear = new Map();
    for (const movie of list) {
      const year = Number(movie?.releaseYear || 0);
      if (!Number.isFinite(year) || year <= 0) continue;
      const key = String(Math.floor(year));
      byYear.set(key, (byYear.get(key) || 0) + 1);
    }
    return Array.from(byYear.entries())
      .map(([key, count]) => ({ key, name: key, count }))
      .sort((a, b) => Number(b.key) - Number(a.key));
  }, [initialMovies]);

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
    const modeKey = String(nextMode || "all").trim().toLowerCase();
    const next = clearMovieSidebarFilters({
      mode: modeKey === "favorites" || modeKey === "recent" || modeKey === "watched" ? modeKey : "all",
      category: "",
      genre: "",
      language: "",
      year: "",
      filterView: "categories",
    });
    pushMovieListUrl(next.mode, next.category, next.genre, next.language, next.year, next.filterView);
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
    pushMovieListUrl(next.mode, next.category, next.genre, next.language, next.year, next.filterView);
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setShowLeftSidebar(false);
    }
  };
  const handleSidebarMovieGenreSelect = (genreKey) => {
    const nextGenre = String(genreKey || "").trim().toLowerCase();
    setHomeMode("movies");
    setMovieViewMode("browse");
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
    pushMovieListUrl(next.mode, next.category, next.genre, next.language, next.year, next.filterView);
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setShowLeftSidebar(false);
    }
  };
  const handleSidebarMovieLanguageSelect = (languageKey) => {
    const nextLanguage = String(languageKey || "").trim().toLowerCase();
    setHomeMode("movies");
    setMovieViewMode("browse");
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
    pushMovieListUrl(next.mode, next.category, next.genre, next.language, next.year, next.filterView);
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setShowLeftSidebar(false);
    }
  };
  const handleSidebarMovieYearSelect = (yearValue) => {
    const nextYear = String(yearValue || "").trim();
    setHomeMode("movies");
    setMovieViewMode("browse");
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
    pushMovieListUrl(next.mode, next.category, next.genre, next.language, next.year, next.filterView);
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
                pushMovieListUrl(movieMode, selectedMovieCategory, selectedMovieGenre, selectedMovieLanguage, selectedMovieYear, movieFilterView);
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
            <MoviesView
              variant={movieViewMode}
              externalFilterResetToken={movieSidebarResetToken}
              initialMovies={initialMovies}
              movieCategories={initialMovieCategories}
              initialContinueWatching={initialContinueWatching}
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
                pushMovieListUrl("all", selectedMovieCategory, nextGenre, selectedMovieLanguage, selectedMovieYear, "genres");
              }}
              onSelectLanguageFilter={(languageKey) => {
                const nextLanguage = String(languageKey || "").trim().toLowerCase();
                setMovieFilterView("genres");
                setMovieMode("all");
                setSelectedMovieLanguage(nextLanguage);
                pushMovieListUrl("all", selectedMovieCategory, selectedMovieGenre, nextLanguage, selectedMovieYear, "genres");
              }}
              onSelectYearFilter={(yearValue) => {
                const nextYear = String(yearValue || "").trim();
                setMovieFilterView("genres");
                setMovieMode("all");
                setSelectedMovieYear(nextYear);
                pushMovieListUrl("all", selectedMovieCategory, selectedMovieGenre, selectedMovieLanguage, nextYear, "genres");
              }}
              onSelectCategoryFilter={(categoryValue) => {
                const nextCategory = String(categoryValue || "").trim().toLowerCase();
                setMovieMode("all");
                setSelectedMovieCategory(nextCategory);
                pushMovieListUrl("all", nextCategory, selectedMovieGenre, selectedMovieLanguage, selectedMovieYear, movieFilterView);
              }}
              onSelectModeFilter={(nextMode) => {
                const modeKey = String(nextMode || "all").trim().toLowerCase();
                setMovieMode(
                  modeKey === "favorites" || modeKey === "recent" || modeKey === "watched" ? modeKey : "all"
                );
                pushMovieListUrl(modeKey, selectedMovieCategory, selectedMovieGenre, selectedMovieLanguage, selectedMovieYear, movieFilterView);
              }}
              onResetFilters={() => {
                setMovieMode("all");
                setSelectedMovieCategory("");
                setSelectedMovieGenre("");
                setSelectedMovieLanguage("");
                setSelectedMovieYear("");
                setMovieFilterView("categories");
                pushMovieListUrl("all", "", "", "", "", "categories");
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
                pushMovieListUrl(movieMode, selectedMovieCategory, selectedMovieGenre, selectedMovieLanguage, selectedMovieYear, movieFilterView);
              }}
              onTrackActivity={trackActivity}
            />
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
