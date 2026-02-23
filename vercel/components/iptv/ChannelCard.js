"use client";

import { Icon } from "./icons";
import styles from "./iptv.module.css";

export default function ChannelCard({ channel, isActive, isFavorite, onToggleFavorite, onClick, isDark }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${styles.channelCard} ${isActive ? styles.channelCardActive : ""} ${isDark ? styles.channelDark : styles.channelLight}`}
    >
      <div className={styles.channelLogoWrap}>
        <div className={styles.channelLogo} style={{ background: channel.gradientStyle }}>
          {channel.logoUrl ? <img src={channel.logoUrl} alt={channel.name} className={styles.channelLogoImg} /> : <span>{channel.logo}</span>}
        </div>
        {channel.isLive ? <span className={styles.liveDot} /> : null}
        <span className={`${styles.playOverlay} ${isActive ? styles.playOverlayVisible : ""}`}>
          <Icon name="Play" size={16} fill="currentColor" />
        </span>
      </div>
      <p className={styles.channelName}>{channel.name}</p>
      <span
        className={`${styles.favoritePin} ${isFavorite ? styles.favoritePinOn : ""}`}
        onClick={(event) => {
          event.stopPropagation();
          onToggleFavorite(channel.id);
        }}
      >
        <Icon name="Heart" size={12} fill={isFavorite ? "currentColor" : "none"} />
      </span>
    </button>
  );
}
