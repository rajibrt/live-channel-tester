"use client";

import { Button } from "../ui/button";
import { Icon } from "./icons";
import styles from "./iptv.module.css";

export default function TopNavbar({
  isDark,
  isTvMode,
  onToggleTheme,
  onToggleTvMode,
  onToggleLeftSidebar,
  onToggleRightPanel,
  debugStats,
}) {
  return (
    <header className={`${styles.topNavbar} ${isDark ? styles.darkGlass : styles.lightGlass}`}>
      <div className={styles.topLeft}>
        <Button type="button" variant="ghost" size="icon" onClick={onToggleLeftSidebar} className={`${styles.iconBtn} ${styles.mobileOnly}`}>
          <Icon name="Menu" size={18} />
        </Button>
        <div className={styles.brandWrap}>
          <div className={styles.brandLogo}>IP</div>
          <h1 className={styles.brandText}>StreamTV</h1>
        </div>
      </div>

      <div className={styles.topMiddle}>
        <div className={`${styles.debugBadge} ${styles.debugBadgeDesktop}`}>
          <strong>Debug</strong>
          <span>links: {debugStats.total}</span>
          <span>live: {debugStats.live}</span>
          <span>home: {debugStats.home}</span>
          <span>categories: {debugStats.categories}</span>
        </div>
      </div>

      <div className={styles.topRight}>
        <Button type="button" variant="ghost" size="icon" onClick={onToggleRightPanel} className={`${styles.iconBtn} ${styles.mobileOnly}`}>
          <Icon name="Grid3x3" size={18} />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onToggleTvMode}
          className={`${styles.iconBtn} ${isTvMode ? styles.tvBtnActive : ""}`}
          title="Toggle TV Remote Mode"
          aria-label="Toggle TV Remote Mode"
        >
          <Icon name="MonitorPlay" size={18} />
        </Button>
        <Button type="button" variant="ghost" size="icon" onClick={onToggleTheme} className={styles.iconBtn}>
          {isDark ? <Icon name="Sun" size={18} stroke="var(--primary)" /> : <Icon name="Moon" size={18} stroke="var(--primary)" />}
        </Button>
        <Button type="button" variant="ghost" size="icon" className={`${styles.iconBtn} ${styles.hideSm}`}>
          <Icon name="Bell" size={18} />
          <span className={styles.badge}>3</span>
        </Button>
        <Button type="button" size="icon" className={styles.userBtn}>
          <Icon name="User" size={18} />
        </Button>
      </div>
    </header>
  );
}
