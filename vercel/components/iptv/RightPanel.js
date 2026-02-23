"use client";

import { Button } from "../ui/button";
import { Input } from "../ui/input";
import ChannelCard from "./ChannelCard";
import { Icon } from "./icons";
import styles from "./iptv.module.css";

export default function RightPanel({
  channels,
  selectedChannel,
  onChannelSelect,
  search,
  onSearch,
  isDark,
  onClose,
  favorites,
  onToggleFavorite,
}) {
  return (
    <aside className={`${styles.rightPanel} ${isDark ? styles.darkGlass : styles.lightGlass}`}>
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
              <ChannelCard
                key={channel.id}
                channel={channel}
                isDark={isDark}
                isActive={selectedChannel?.id === channel.id}
                isFavorite={favorites.includes(channel.id)}
                onToggleFavorite={onToggleFavorite}
                onClick={() => onChannelSelect(channel)}
              />
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
