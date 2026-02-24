"use client";

import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Icon } from "./icons";
import styles from "./iptv.module.css";

export default function LeftSidebar({
  categories,
  selectedCategory,
  mode,
  onSelectCategory,
  onSelectMode,
  isDark,
  onClose,
  search,
  onSearch,
}) {
  const filteredCategories = categories.filter((category) =>
    category.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <aside className={`${styles.leftSidebar} ${isDark ? styles.darkGlass : styles.lightGlass}`}>
      <div className={styles.sidebarTop}>
        <div className={styles.sidebarHeaderMobile}>
          <h2>Menu</h2>
          <Button type="button" variant="ghost" size="icon" className={styles.closeBtn} onClick={onClose}>
            <Icon name="X" size={18} />
          </Button>
        </div>

        <div className={styles.searchWrap}>
          <Icon name="Search" size={14} className={styles.searchIcon} />
          <Input
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Search Category"
            className={styles.searchInput}
          />
        </div>

        <div className={styles.quickLinks}>
          <Button
            type="button"
            onClick={() => {
              onSelectMode("all");
              onSelectCategory(null);
            }}
            className={`justify-start ${styles.linkBtn} ${mode === "all" && !selectedCategory ? styles.linkBtnActive : ""}`}
          >
            <Icon name="MonitorPlay" size={16} />
            <span>All Channels</span>
          </Button>
          <Button
            type="button"
            onClick={() => {
              onSelectMode("favorites");
              onSelectCategory(null);
            }}
            className={`justify-start ${styles.linkBtn} ${mode === "favorites" ? styles.linkBtnActive : ""}`}
          >
            <Icon name="Heart" size={16} />
            <span>Favourites</span>
          </Button>
          <Button
            type="button"
            onClick={() => {
              onSelectMode("recent");
              onSelectCategory(null);
            }}
            className={`justify-start ${styles.linkBtn} ${mode === "recent" ? styles.linkBtnActive : ""}`}
          >
            <Icon name="Clock" size={16} />
            <span>Recently Watched</span>
          </Button>
        </div>
      </div>

      <div className={styles.sidebarList}>
        <h3 className={styles.sidebarLabel}>Categories</h3>
        {filteredCategories.map((category) => (
          <Button
            key={category.id}
            type="button"
            onClick={() => {
              onSelectMode("all");
              onSelectCategory(category.id);
            }}
            className={`justify-start ${styles.linkBtn} ${selectedCategory === category.id && mode === "all" ? styles.linkBtnActive : ""}`}
          >
            <Icon name={category.icon} size={16} />
            <span className={styles.linkText}>{category.name}</span>
            <span className={styles.linkCount} aria-label={`${category.name} channels`}>
              {Number(category.count || 0)}
            </span>
          </Button>
        ))}
      </div>
    </aside>
  );
}
