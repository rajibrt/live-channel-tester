"use client";

import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Icon } from "./icons";
import styles from "./iptv.module.css";

export default function LeftSidebar({
  categories,
  movieCategories = [],
  movieGenres = [],
  movieLanguages = [],
  movieYears = [],
  selectedCategory,
  selectedMovieCategory = "",
  selectedMovieGenre = "",
  selectedMovieLanguage = "",
  selectedMovieYear = "",
  mode,
  movieMode = "all",
  movieFilterView = "categories",
  movieStats = {},
  homeMode = "tv",
  onSelectHomeMode,
  onSelectCategory,
  onSelectMode,
  onSelectMovieCategory,
  onSelectMovieGenre,
  onSelectMovieLanguage,
  onSelectMovieYear,
  onSelectMovieFilterView,
  onSelectMovieMode,
  isDark,
  onClose,
  search,
  onSearch,
}) {
  const filteredCategories = categories.filter((category) =>
    category.name.toLowerCase().includes(search.toLowerCase())
  );
  const filteredMovieCategories = movieCategories.filter((category) =>
    String(category?.name || "").toLowerCase().includes(search.toLowerCase())
  );
  const filteredMovieGenres = movieGenres.filter((genre) =>
    String(genre?.name || "").toLowerCase().includes(search.toLowerCase())
  );
  const filteredMovieLanguages = movieLanguages.filter((language) =>
    String(language?.name || "").toLowerCase().includes(search.toLowerCase())
  );
  const filteredMovieYears = movieYears.filter((yearRow) =>
    String(yearRow?.name || "").toLowerCase().includes(search.toLowerCase())
  );
  const movieAllCount = Number(movieStats?.all || 0);
  const movieFavoriteCount = Number(movieStats?.favorites || 0);
  const movieRecentCount = Number(movieStats?.recent || 0);
  const movieWatchedCount = Number(movieStats?.watched || 0);
  const labelClass = `${styles.sidebarLabel} ${homeMode === "movies" ? styles.sidebarLabelCompact : ""}`;
  const rowClass = `${styles.linkBtn} ${homeMode === "movies" ? styles.linkBtnCompact : ""} focus-visible:ring-0`;
  const countClass = `${styles.linkCount} ${homeMode === "movies" ? styles.linkCountCompact : ""}`;

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
            placeholder={
              homeMode === "movies"
                ? movieFilterView === "genres"
                  ? "Search Genre or Language"
                  : "Search Movie Category"
                : "Search Category"
            }
            className={styles.searchInput}
          />
        </div>

        <div className={styles.quickLinks}>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              onSelectHomeMode?.("tv");
            }}
            className={`justify-start ${styles.linkBtn} ${homeMode === "tv" ? styles.linkBtnActive : ""}`}
          >
            <Icon name="MonitorPlay" size={16} />
            <span>Live TV Channels</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              onSelectHomeMode?.("movies");
            }}
            className={`justify-start ${styles.linkBtn} ${homeMode === "movies" ? styles.linkBtnActive : ""}`}
          >
            <Icon name="Film" size={16} />
            <span>Movies</span>
          </Button>
        </div>
      </div>

      <div className={`${styles.sidebarList} ${homeMode === "movies" ? styles.sidebarListCompact : ""}`}>
        {homeMode === "tv" ? (
          <>
            <h3 className={labelClass}>Live TV</h3>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                onSelectMode?.("all");
                onSelectCategory?.(null);
              }}
              className={`justify-start ${rowClass} ${mode === "all" && !selectedCategory ? styles.linkBtnActive : ""}`}
            >
              <Icon name="MonitorPlay" size={16} />
              <span>All Channels</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                onSelectMode?.("favorites");
                onSelectCategory?.(null);
              }}
              className={`justify-start ${rowClass} ${mode === "favorites" ? styles.linkBtnActive : ""}`}
            >
              <Icon name="Heart" size={16} />
              <span>Favourites</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                onSelectMode?.("recent");
                onSelectCategory?.(null);
              }}
              className={`justify-start ${rowClass} ${mode === "recent" ? styles.linkBtnActive : ""}`}
            >
              <Icon name="Clock" size={16} />
              <span>Recently Watched</span>
            </Button>
            <h3 className={labelClass}>Categories</h3>
            {filteredCategories.map((category) => (
              <Button
                key={category.id}
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  onSelectMode?.("all");
                  onSelectCategory?.(category.id);
                }}
                className={`justify-start ${rowClass} ${selectedCategory === category.id && mode === "all" ? styles.linkBtnActive : ""}`}
              >
                <Icon name={category.icon} size={16} />
                <span className={styles.linkText}>{category.name}</span>
                <span className={styles.linkCount} aria-label={`${category.name} channels`}>
                  {Number(category.count || 0)}
                </span>
              </Button>
            ))}
          </>
        ) : (
          <>
            <h3 className={labelClass}>Movies</h3>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                onSelectMovieCategory?.("");
              }}
              className={`justify-start ${rowClass} ${movieMode === "all" && !selectedMovieCategory ? styles.linkBtnActive : ""}`}
            >
              <Icon name="Film" size={16} />
              <span>All Movies</span>
              <span className={countClass}>{movieAllCount}</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                onSelectMovieMode?.("favorites");
              }}
              className={`justify-start ${rowClass} ${movieMode === "favorites" ? styles.linkBtnActive : ""}`}
            >
              <Icon name="Heart" size={16} />
              <span>Favourites</span>
              <span className={countClass}>{movieFavoriteCount}</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                onSelectMovieMode?.("recent");
              }}
              className={`justify-start ${rowClass} ${movieMode === "recent" ? styles.linkBtnActive : ""}`}
            >
              <Icon name="Clock" size={16} />
              <span>Recently Watched</span>
              <span className={countClass}>{movieRecentCount}</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                onSelectMovieMode?.("watched");
              }}
              className={`justify-start ${rowClass} ${movieMode === "watched" ? styles.linkBtnActive : ""}`}
            >
              <Icon name="Eye" size={16} />
              <span>Watched List</span>
              <span className={countClass}>{movieWatchedCount}</span>
            </Button>
            <h3 className={labelClass}>Movie Categories</h3>
            {filteredMovieCategories.map((category) => (
              <Button
                key={category.id || category.slug}
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  onSelectMovieCategory?.(String(category.slug || ""));
                }}
                className={`justify-start ${rowClass} ${movieMode === "all" && selectedMovieCategory === String(category.slug || "") ? styles.linkBtnActive : ""}`}
              >
                <Icon name="Film" size={16} />
                <span className={styles.linkText}>{category.name}</span>
                <span className={countClass}>{Number(category.count || 0)}</span>
              </Button>
            ))}
            <h3 className={labelClass}>Language List</h3>
            {filteredMovieLanguages.map((language) => (
              <Button
                key={language.key || language.name}
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  onSelectMovieLanguage?.(String(language.key || "").toLowerCase());
                }}
                className={`justify-start ${rowClass} ${movieMode === "all" && selectedMovieLanguage === String(language.key || "").toLowerCase() ? styles.linkBtnActive : ""}`}
              >
                <Icon name="Globe" size={16} />
                <span className={styles.linkText}>{language.name}</span>
                <span className={countClass}>{Number(language.count || 0)}</span>
              </Button>
            ))}
            <h3 className={labelClass}>Genres</h3>
            {filteredMovieGenres.map((genre) => (
              <Button
                key={genre.key || genre.name}
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  onSelectMovieGenre?.(String(genre.key || "").toLowerCase());
                }}
                className={`justify-start ${rowClass} ${movieMode === "all" && selectedMovieGenre === String(genre.key || "").toLowerCase() ? styles.linkBtnActive : ""}`}
              >
                <Icon name="Tags" size={16} />
                <span className={styles.linkText}>{genre.name}</span>
                <span className={countClass}>{Number(genre.count || 0)}</span>
              </Button>
            ))}
            <h3 className={labelClass}>Years</h3>
            {filteredMovieYears.map((yearRow) => (
              <Button
                key={yearRow.key || yearRow.name}
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  onSelectMovieYear?.(String(yearRow.key || ""));
                }}
                className={`justify-start ${rowClass} ${movieMode === "all" && selectedMovieYear === String(yearRow.key || "") ? styles.linkBtnActive : ""}`}
              >
                <Icon name="Clock" size={16} />
                <span className={styles.linkText}>{yearRow.name}</span>
                <span className={countClass}>{Number(yearRow.count || 0)}</span>
              </Button>
            ))}
          </>
        )}
      </div>
    </aside>
  );
}
