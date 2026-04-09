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
  tvStats = {},
  movieMode = "all",
  movieFilterView = "categories",
  movieStats = {},
  homeMode = "tv",
  isTvMode = false,
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
  const tvAllCount = Number(tvStats?.all || 0);
  const tvFavoriteCount = Number(tvStats?.favorites || 0);
  const tvRecentCount = Number(tvStats?.recent || 0);
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
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={styles.closeBtn}
            onClick={onClose}
            data-tv-focusable={isTvMode ? "true" : undefined}
            data-tv-focus-scope={isTvMode ? "left-nav" : undefined}
            data-tv-focus-id={isTvMode ? "leftnav-close" : undefined}
          >
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
            data-tv-focusable={isTvMode ? "true" : undefined}
            data-tv-focus-scope={isTvMode ? "left-nav" : undefined}
            data-tv-focus-id={isTvMode ? "leftnav-search" : undefined}
            data-tv-default-focus={isTvMode ? "true" : undefined}
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
            data-tv-focusable={isTvMode ? "true" : undefined}
            data-tv-focus-scope={isTvMode ? "left-nav" : undefined}
            data-tv-focus-id={isTvMode ? "leftnav-home-tv" : undefined}
            data-tv-active={isTvMode && homeMode === "tv" ? "true" : undefined}
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
            data-tv-focusable={isTvMode ? "true" : undefined}
            data-tv-focus-scope={isTvMode ? "left-nav" : undefined}
            data-tv-focus-id={isTvMode ? "leftnav-home-movies" : undefined}
            data-tv-active={isTvMode && homeMode === "movies" ? "true" : undefined}
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
              data-tv-focusable={isTvMode ? "true" : undefined}
              data-tv-focus-scope={isTvMode ? "left-nav" : undefined}
              data-tv-focus-id={isTvMode ? "leftnav-tv-all" : undefined}
              data-tv-active={isTvMode && mode === "all" && !selectedCategory ? "true" : undefined}
            >
              <Icon name="MonitorPlay" size={16} />
              <span>All Channels</span>
              <span className={countClass}>{tvAllCount}</span>
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
              data-tv-focusable={isTvMode ? "true" : undefined}
              data-tv-focus-scope={isTvMode ? "left-nav" : undefined}
              data-tv-focus-id={isTvMode ? "leftnav-tv-favorites" : undefined}
              data-tv-active={isTvMode && mode === "favorites" ? "true" : undefined}
            >
              <Icon name="Heart" size={16} />
              <span>Favourites</span>
              <span className={countClass}>{tvFavoriteCount}</span>
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
              data-tv-focusable={isTvMode ? "true" : undefined}
              data-tv-focus-scope={isTvMode ? "left-nav" : undefined}
              data-tv-focus-id={isTvMode ? "leftnav-tv-recent" : undefined}
              data-tv-active={isTvMode && mode === "recent" ? "true" : undefined}
            >
              <Icon name="Clock" size={16} />
              <span>Recently Watched</span>
              <span className={countClass}>{tvRecentCount}</span>
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
                data-tv-focusable={isTvMode ? "true" : undefined}
                data-tv-focus-scope={isTvMode ? "left-nav" : undefined}
                data-tv-focus-id={isTvMode ? `leftnav-category-${category.id}` : undefined}
                data-tv-active={isTvMode && selectedCategory === category.id && mode === "all" ? "true" : undefined}
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
              data-tv-focusable={isTvMode ? "true" : undefined}
              data-tv-focus-scope={isTvMode ? "left-nav" : undefined}
              data-tv-focus-id={isTvMode ? "leftnav-movies-all" : undefined}
              data-tv-active={isTvMode && movieMode === "all" && !selectedMovieCategory ? "true" : undefined}
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
              data-tv-focusable={isTvMode ? "true" : undefined}
              data-tv-focus-scope={isTvMode ? "left-nav" : undefined}
              data-tv-focus-id={isTvMode ? "leftnav-movies-favorites" : undefined}
              data-tv-active={isTvMode && movieMode === "favorites" ? "true" : undefined}
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
              data-tv-focusable={isTvMode ? "true" : undefined}
              data-tv-focus-scope={isTvMode ? "left-nav" : undefined}
              data-tv-focus-id={isTvMode ? "leftnav-movies-recent" : undefined}
              data-tv-active={isTvMode && movieMode === "recent" ? "true" : undefined}
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
              data-tv-focusable={isTvMode ? "true" : undefined}
              data-tv-focus-scope={isTvMode ? "left-nav" : undefined}
              data-tv-focus-id={isTvMode ? "leftnav-movies-watched" : undefined}
              data-tv-active={isTvMode && movieMode === "watched" ? "true" : undefined}
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
                data-tv-focusable={isTvMode ? "true" : undefined}
                data-tv-focus-scope={isTvMode ? "left-nav" : undefined}
                data-tv-focus-id={isTvMode ? `leftnav-movie-category-${String(category.slug || category.id || "")}` : undefined}
                data-tv-active={isTvMode && movieMode === "all" && selectedMovieCategory === String(category.slug || "") ? "true" : undefined}
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
                data-tv-focusable={isTvMode ? "true" : undefined}
                data-tv-focus-scope={isTvMode ? "left-nav" : undefined}
                data-tv-focus-id={isTvMode ? `leftnav-language-${String(language.key || language.name || "").toLowerCase()}` : undefined}
                data-tv-active={isTvMode && movieMode === "all" && selectedMovieLanguage === String(language.key || "").toLowerCase() ? "true" : undefined}
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
                data-tv-focusable={isTvMode ? "true" : undefined}
                data-tv-focus-scope={isTvMode ? "left-nav" : undefined}
                data-tv-focus-id={isTvMode ? `leftnav-genre-${String(genre.key || genre.name || "").toLowerCase()}` : undefined}
                data-tv-active={isTvMode && movieMode === "all" && selectedMovieGenre === String(genre.key || "").toLowerCase() ? "true" : undefined}
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
                data-tv-focusable={isTvMode ? "true" : undefined}
                data-tv-focus-scope={isTvMode ? "left-nav" : undefined}
                data-tv-focus-id={isTvMode ? `leftnav-year-${String(yearRow.key || yearRow.name || "")}` : undefined}
                data-tv-active={isTvMode && movieMode === "all" && selectedMovieYear === String(yearRow.key || "") ? "true" : undefined}
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
