"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./iptv.module.css";

const INITIAL_COUNT = 48;

function ChannelTile({ channel, isActive, onClick }) {
  const [logoFailed, setLogoFailed] = useState(false);
  useEffect(() => setLogoFailed(false), [channel.logoUrl, channel.id]);
  const fallback = String(channel.logo || channel.name || "TV").trim().slice(0, 2).toUpperCase() || "TV";
  const showImage = Boolean(channel.logoUrl) && !logoFailed;
  return (
    <button
      type="button"
      className={`${styles.channelTile} ${isActive ? styles.channelTileActive : ""}`}
      onClick={onClick}
      aria-current={isActive ? "true" : undefined}
      title={channel.name}
    >
      <span className={styles.channelTileLogo} style={showImage ? undefined : { background: channel.gradientStyle }}>
        {showImage ? (
          <img src={channel.logoUrl} alt="" loading="lazy" onError={() => setLogoFailed(true)} />
        ) : (
          <span>{fallback}</span>
        )}
        {isActive ? <span className={styles.channelTilePlaying} aria-hidden="true" /> : null}
      </span>
      <span className={styles.channelTileName}>{channel.name}</span>
    </button>
  );
}

// Phone/tablet only (hidden by CSS on wide screens, where the right panel is
// always visible): the channels of the playing channel's category as a tile
// grid under the player, so viewers can switch without opening the drawer.
export default function MobileCategoryChannels({ channels, categoryName, selectedChannel, onSelectChannel }) {
  const [expanded, setExpanded] = useState(false);
  const list = Array.isArray(channels) ? channels : [];

  useEffect(() => {
    setExpanded(false);
  }, [categoryName]);

  const shown = useMemo(() => {
    if (expanded || list.length <= INITIAL_COUNT) return list;
    const head = list.slice(0, INITIAL_COUNT);
    const selectedId = String(selectedChannel?.id || "");
    if (selectedId && !head.some((c) => String(c.id) === selectedId)) {
      const playing = list.find((c) => String(c.id) === selectedId);
      if (playing) return [playing, ...head];
    }
    return head;
  }, [list, expanded, selectedChannel?.id]);

  if (!list.length) return null;

  return (
    <section className={styles.mobileCategoryList} aria-label={`Channels in ${categoryName || "this category"}`}>
      <div className={styles.mobileCategoryHead}>
        <h2>{categoryName || "Channels"}</h2>
        <span>{list.length} channels</span>
      </div>
      <div className={styles.mobileCategoryItems}>
        {shown.map((channel) => (
          <ChannelTile
            key={channel.id}
            channel={channel}
            isActive={String(selectedChannel?.id || "") === String(channel.id)}
            onClick={() => onSelectChannel(channel)}
          />
        ))}
      </div>
      {!expanded && list.length > INITIAL_COUNT ? (
        <button type="button" className={styles.mobileCategoryMore} onClick={() => setExpanded(true)}>
          Show all {list.length} channels
        </button>
      ) : null}
    </section>
  );
}
