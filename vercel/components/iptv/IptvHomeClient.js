"use client";

import { useEffect, useMemo, useState } from "react";
import LeftSidebar from "./LeftSidebar";
import RightPanel from "./RightPanel";
import TopNavbar from "./TopNavbar";
import VideoPlayer from "./VideoPlayer";
import styles from "./iptv.module.css";
import { usePersistentArray } from "./usePersistentArray";

const LAST_CHANNEL_KEY = "iptv:v1:last-channel-id";

function toCategoryId(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function IptvHomeClient({ initialChannels = [], initialCategories = [] }) {
  const [isDark, setIsDark] = useState(() => {
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
  const [favorites, setFavorites] = usePersistentArray("favorites", []);
  const [recent, setRecent] = usePersistentArray("recent", []);
  const [isTvDevice, setIsTvDevice] = useState(false);
  const [forceTvMode, setForceTvMode] = useState(false);
  const [hasRestoredChannel, setHasRestoredChannel] = useState(false);

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
    if (hasRestoredChannel) return;
    if (!allChannels.length) return;

    try {
      const savedId = String(window.localStorage.getItem(LAST_CHANNEL_KEY) || "").trim();
      if (savedId) {
        const restored = allChannels.find((item) => String(item.id) === savedId);
        if (restored) {
          setSelectedChannel(restored);
          setRecent((prev) => {
            const next = [restored.id, ...prev.filter((id) => id !== restored.id)];
            return next.slice(0, 30);
          });
        }
      }
    } catch {
      // ignore localStorage read issues
    }

    setHasRestoredChannel(true);
  }, [allChannels, hasRestoredChannel, setRecent]);

  useEffect(() => {
    const id = String(selectedChannel?.id || "").trim();
    if (!id) return;
    try {
      window.localStorage.setItem(LAST_CHANNEL_KEY, id);
    } catch {
      // ignore localStorage write issues
    }
  }, [selectedChannel]);

  const recentSet = useMemo(() => new Set(recent), [recent]);
  const liveCount = useMemo(() => allChannels.filter((item) => item.isLive).length, [allChannels]);

  const visibleChannels = useMemo(() => {
    let list = allChannels;

    if (mode === "favorites") {
      const favoriteSet = new Set(favorites);
      list = list.filter((channel) => favoriteSet.has(channel.id));
    }

    if (mode === "recent") {
      list = list.filter((channel) => recentSet.has(channel.id));
      const recentOrder = new Map(recent.map((id, index) => [id, index]));
      list = list.slice().sort((a, b) => (recentOrder.get(a.id) ?? 9999) - (recentOrder.get(b.id) ?? 9999));
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
    setFavorites((prev) => (prev.includes(channelId) ? prev.filter((id) => id !== channelId) : [...prev, channelId]));
  };

  const selectedIndex = useMemo(() => {
    if (!selectedChannel?.id) return -1;
    return visibleChannels.findIndex((item) => item.id === selectedChannel.id);
  }, [visibleChannels, selectedChannel]);

  const handleSelectChannel = (channel) => {
    setSelectedChannel(channel);
    setRecent((prev) => {
      const next = [channel.id, ...prev.filter((id) => id !== channel.id)];
      return next.slice(0, 30);
    });
    if (window.innerWidth < 1024) setShowRightPanel(false);
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
        onToggleTheme={() => setIsDark((prev) => !prev)}
        onToggleTvMode={() => setForceTvMode((prev) => !prev)}
        onToggleLeftSidebar={() => setShowLeftSidebar((prev) => !prev)}
        onToggleRightPanel={() => setShowRightPanel((prev) => !prev)}
        debugStats={debugStats}
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
            isFavorite={selectedChannel ? favorites.includes(selectedChannel.id) : false}
            onToggleFavorite={toggleFavorite}
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
    </main>
  );
}
