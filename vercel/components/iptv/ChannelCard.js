"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "./icons";
import styles from "./iptv.module.css";

export default function ChannelCard({ channel, isActive, isFavorite, onToggleFavorite, onClick, isDark }) {
  const [logoFailed, setLogoFailed] = useState(false);

  useEffect(() => {
    setLogoFailed(false);
  }, [channel.logoUrl, channel.id]);

  const fallbackLogo = useMemo(() => {
    const raw = String(channel.logo || channel.name || "TV").trim();
    if (!raw) return "TV";
    return raw.slice(0, 2).toUpperCase();
  }, [channel.logo, channel.name]);

  const showImage = Boolean(channel.logoUrl) && !logoFailed;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`${styles.channelCard} ${isActive ? styles.channelCardActive : ""} ${isDark ? styles.channelDark : styles.channelLight}`}
    >
      <div className={styles.channelLogoWrap}>
        <div className={styles.channelLogo} style={{ background: channel.gradientStyle }}>
          {showImage ? (
            <img
              src={channel.logoUrl}
              alt=""
              className={styles.channelLogoImg}
              loading="lazy"
              onError={() => setLogoFailed(true)}
            />
          ) : (
            <span className={styles.channelLogoFallback}>{fallbackLogo}</span>
          )}
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
