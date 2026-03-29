"use client";

import { useEffect, useRef } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import ChannelCard from "./ChannelCard";
import { Icon } from "./icons";
import styles from "./iptv.module.css";

export default function RightPanel({
  channels,
  selectedChannel,
  categoryKey = "",
  onChannelSelect,
  search,
  onSearch,
  isDark,
  onClose,
  favorites,
  onToggleFavorite,
}) {
  const panelRef = useRef(null);
  const channelRefs = useRef(new Map());

  useEffect(() => {
    const container = panelRef.current;
    if (!container) return;

    const selectedId = String(selectedChannel?.id || "").trim();
    const card = selectedId ? channelRefs.current.get(selectedId) : null;

    if (!card) {
      container.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    // Scroll only within the panel — never touch window/page scroll.
    const containerRect = container.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    const offset = cardRect.top - containerRect.top - containerRect.height / 2 + cardRect.height / 2;
    container.scrollBy({ top: offset, behavior: "smooth" });
  }, [selectedChannel?.id, channels.length, categoryKey]);

  return (
    <aside ref={panelRef} className={`${styles.rightPanel} ${isDark ? styles.darkGlass : styles.lightGlass}`}>
      <div className={styles.rightHeader}>
        <div className={styles.sidebarHeaderMobile}>
          <h2>Channels</h2>
          <Button type="button" variant="ghost" size="icon" className={styles.closeBtn} onClick={onClose}>
            <Icon name="X" size={18} />
          </Button>
        </div>
        <h2 className={styles.desktopTitle}>Available Channels</h2>
        <p className={styles.rightMeta}>{channels.length} channels available</p>
        <div className={styles.searchWrap}>
          <Icon name="Search" size={14} className={styles.searchIcon} />
          <Input
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Search channels..."
            className={styles.searchInput}
          />
        </div>
      </div>

      <div className={styles.rightBody}>
        {channels.length ? (
          <div className={styles.channelGrid}>
            {channels.map((channel) => (
              <div
                className={styles.channelGridItem}
                key={channel.id}
                ref={(node) => {
                  const key = String(channel.id);
                  if (node) channelRefs.current.set(key, node);
                  else channelRefs.current.delete(key);
                }}
              >
                <ChannelCard
                  channel={channel}
                  isDark={isDark}
                  isActive={selectedChannel?.id === channel.id}
                  isFavorite={favorites.includes(String(channel.id))}
                  onToggleFavorite={onToggleFavorite}
                  onClick={() => onChannelSelect(channel)}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <Icon name="Search" size={42} />
            <p>No channels found</p>
            <small>Try a different search term</small>
          </div>
        )}
      </div>
    </aside>
  );
}
