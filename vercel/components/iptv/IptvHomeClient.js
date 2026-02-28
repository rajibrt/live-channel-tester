"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import LeftSidebar from "./LeftSidebar";
import RightPanel from "./RightPanel";
import TopNavbar from "./TopNavbar";
import VideoPlayer from "./VideoPlayer";
import CookieConsentBanner from "./CookieConsentBanner";
import styles from "./iptv.module.css";
import { usePersistentArray } from "./usePersistentArray";

const LAST_CHANNEL_KEY = "iptv:v1:last-channel-id";

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
  initialClientState = {},
  currentClient = {},
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
  const [mode, setMode] = useState("all");
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
      body: JSON.stringify({ event_type: eventType, event_data: eventData || {} }),
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
    const sendPing = () => {
      trackActivity("presence_ping", {
        route: "home",
        channel_id: String(selectedChannel?.id || ""),
        channel_name: String(selectedChannel?.name || ""),
      });
    };
    sendPing();
    const timer = setInterval(sendPing, 30000);
    return () => clearInterval(timer);
  }, [selectedChannel?.id, selectedChannel?.name]);

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
    if (cookieConsent !== "accepted") return;
    if (hasRestoredChannel) return;
    if (!allChannels.length) return;

    try {
      const seeded = String(initialClientState?.lastChannelId || "").trim();
      const savedId = seeded || String(window.localStorage.getItem(LAST_CHANNEL_KEY) || "").trim();
      if (savedId) {
        const restored = allChannels.find((item) => String(item.id) === savedId);
        if (restored) {
          setSelectedChannel(restored);
          setMode("all");
          setSelectedCategory(String(restored.categoryId || "").trim() || null);
          setRecent((prev) => {
            const restoredId = normalizeChannelId(restored.id);
            const next = [restoredId, ...prev.filter((id) => normalizeChannelId(id) !== restoredId)];
            return next.slice(0, 30);
          });
        }
      }
    } catch {
      // ignore localStorage read issues
    }

    setHasRestoredChannel(true);
  }, [allChannels, cookieConsent, hasRestoredChannel, setRecent, initialClientState?.lastChannelId]);

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
            selectedCategory={selectedCategory}
            mode={mode}
            onSelectCategory={handleSidebarCategorySelect}
            onSelectMode={handleSidebarModeSelect}
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
          />
          <div className={`${styles.debugBadge} ${styles.debugBadgeMobile}`}>
            <strong>Debug</strong>
            <span>links: {debugStats.total}</span>
            <span>live: {debugStats.live}</span>
            <span>home: {debugStats.home}</span>
            <span>categories: {debugStats.categories}</span>
          </div>
        </section>

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
