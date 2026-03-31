import { getSupabaseAdmin } from "./supabaseAdmin";
import { isPrivateNetworkUrl, normalizeStreamUrl, toStreamProxyUrl } from "./streamUrl";
import { deriveWatchState, isWatchedProgress, normalizeSeconds } from "./movieProgress";
import { inferVideoQualityLabelFromUrl } from "./videoQuality";

const MOVIE_SELECT_COLUMNS =
  "id,slug,title,synopsis,poster_url,backdrop_url,release_year,runtime_seconds,is_published,updated_at,imdb_id,imdb_url,imdb_rating,imdb_votes,content_rating,imdb_genres,imdb_directors,imdb_writers,imdb_stars,imdb_release_date,imdb_countries,imdb_languages,video_quality";
const DEFAULT_MOVIES_PAGE_SIZE = 24;
const MAX_MOVIES_PAGE_SIZE = 60;
const DB_SCAN_PAGE_SIZE = 500;

function text(value) {
  return String(value || "").trim();
}

function normalizeCategorySlug(value) {
  return text(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toStringList(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of value) {
    const item = text(raw);
    const key = item.toLowerCase();
    if (!item || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function inferLanguagesFromCategories(categoryRows) {
  const list = Array.isArray(categoryRows) ? categoryRows : [];
  const known = [
    "bangla",
    "bengali",
    "hindi",
    "english",
    "tamil",
    "telugu",
    "malayalam",
    "kannada",
    "punjabi",
    "urdu",
    "japanese",
    "korean",
    "chinese",
    "arabic",
    "spanish",
    "french",
    "german",
    "turkish",
    "thai",
    "indonesian",
  ];
  const titleCase = (v) => v.charAt(0).toUpperCase() + v.slice(1);
  const out = [];
  const seen = new Set();
  for (const row of list) {
    const slug = normalizeCategorySlug(row?.slug || row?.name || "");
    if (!slug) continue;
    for (const lang of known) {
      if (slug === lang || slug.includes(`-${lang}`) || slug.includes(`${lang}-`) || slug.includes(lang)) {
        const label = titleCase(lang);
        const key = label.toLowerCase();
        if (seen.has(key)) break;
        seen.add(key);
        out.push(label);
        break;
      }
    }
  }
  return out;
}

function toMovieShape(movie, categoryRows, sourceRows, progressRow, isFavorite) {
  const runtimeSeconds = normalizeSeconds(movie?.runtime_seconds);
  const positionSeconds = normalizeSeconds(progressRow?.position_seconds);
  const durationSeconds = normalizeSeconds(progressRow?.duration_seconds || runtimeSeconds);
  const progressPercent = Number(progressRow?.progress_percent || 0);
  const clampedProgress = Math.max(0, Math.min(100, Number.isFinite(progressPercent) ? progressPercent : 0));
  const isCompleted = Boolean(progressRow?.is_completed) || isWatchedProgress(clampedProgress);
  const sortedSources = (Array.isArray(sourceRows) ? sourceRows : [])
    .filter((row) => Boolean(row?.is_active))
    .sort((a, b) => {
      const orderDiff = Number(a?.sort_order || 0) - Number(b?.sort_order || 0);
      if (orderDiff !== 0) return orderDiff;
      return Number(a?.id || 0) - Number(b?.id || 0);
    });

  const firstSource = sortedSources[0] || null;
  const normalizedSource = normalizeStreamUrl(firstSource?.source_url || "");
  const privateDirectRaw = String(process.env.STREAM_PRIVATE_DIRECT_PLAYBACK || "true").trim();
  const usePrivateDirectPlayback = !/^(0|false|no|off)$/i.test(privateDirectRaw);
  const isPrivateSource = normalizedSource ? isPrivateNetworkUrl(normalizedSource) : false;
  const playbackUrl = normalizedSource
    ? (usePrivateDirectPlayback && isPrivateSource
        ? normalizedSource
        : toStreamProxyUrl(normalizedSource) || normalizedSource)
    : "";

  const watchState = deriveWatchState({
    positionSeconds,
    progressPercent: isCompleted ? 100 : clampedProgress,
  });

  const dbLanguages = toStringList(movie?.imdb_languages);
  const fallbackLanguages = inferLanguagesFromCategories(categoryRows);
  const effectiveLanguages = toStringList([...dbLanguages, ...fallbackLanguages]);

  return {
    id: String(movie?.id || ""),
    slug: text(movie?.slug),
    title: text(movie?.title) || "Untitled",
    synopsis: text(movie?.synopsis),
    posterUrl: text(movie?.poster_url),
    backdropUrl: text(movie?.backdrop_url),
    releaseYear: Number.isFinite(Number(movie?.release_year)) ? Number(movie.release_year) : null,
    runtimeSeconds,
    imdbId: text(movie?.imdb_id),
    imdbUrl: text(movie?.imdb_url),
    imdbRating: Number.isFinite(Number(movie?.imdb_rating)) ? Number(movie.imdb_rating) : null,
    imdbVotes: Number.isFinite(Number(movie?.imdb_votes)) ? Number(movie.imdb_votes) : null,
    contentRating: text(movie?.content_rating),
    imdbGenres: toStringList(movie?.imdb_genres),
    imdbDirectors: toStringList(movie?.imdb_directors),
    imdbWriters: toStringList(movie?.imdb_writers),
    imdbStars: toStringList(movie?.imdb_stars),
    imdbReleaseDate: text(movie?.imdb_release_date),
    imdbCountries: toStringList(movie?.imdb_countries),
    imdbLanguages: effectiveLanguages,
    videoQuality: text(movie?.video_quality) || inferVideoQualityLabelFromUrl(firstSource?.source_url || ""),
    categories: (Array.isArray(categoryRows) ? categoryRows : []).map((row) => ({
      id: String(row?.id || ""),
      slug: normalizeCategorySlug(row?.slug || row?.name || ""),
      name: text(row?.name) || "Category",
    })),
    categorySlugs: (Array.isArray(categoryRows) ? categoryRows : [])
      .map((row) => normalizeCategorySlug(row?.slug || row?.name || ""))
      .filter(Boolean),
    source: firstSource
      ? {
          id: String(firstSource.id),
          label: text(firstSource.label) || "default",
          rawUrl: normalizedSource,
          playbackUrl,
        }
      : null,
    rawPlaybackUrl: normalizedSource,
    playbackUrl,
    isFavorite: Boolean(isFavorite),
    progress: {
      positionSeconds,
      durationSeconds,
      progressPercent: Math.round(clampedProgress * 100) / 100,
      isCompleted,
      updatedAt: text(progressRow?.updated_at),
    },
    watchState,
    updatedAt: text(movie?.updated_at),
  };
}

function clampPageSize(value) {
  const size = Math.floor(Number(value) || DEFAULT_MOVIES_PAGE_SIZE);
  return Math.max(1, Math.min(MAX_MOVIES_PAGE_SIZE, size));
}

function clampPage(value) {
  const page = Math.floor(Number(value) || 1);
  return Math.max(1, page);
}

function normalizeMovieFilterOptions(options = {}) {
  const mode = text(options?.mode).toLowerCase();
  const category = text(options?.category).toLowerCase();
  const genre = text(options?.genre).toLowerCase();
  const language = text(options?.language).toLowerCase();
  const year = text(options?.year);
  const search = text(options?.search).toLowerCase();
  return {
    mode: mode === "favorites" || mode === "recent" || mode === "watched" ? mode : "all",
    category,
    genre,
    language,
    year,
    search,
  };
}

function hasMoviePageFilters(options = {}) {
  const filters = normalizeMovieFilterOptions(options);
  return Boolean(
    filters.category || filters.genre || filters.language || filters.year || filters.search || filters.mode !== "all"
  );
}

function parseMovieSearchQuery(rawSearch) {
  const normalized = text(rawSearch).toLowerCase();
  const genreMatch = normalized.match(/\bgenres?:\s*([a-z0-9\-\s,]+)/i);
  const genreQuery = genreMatch ? text(genreMatch[1]).toLowerCase() : "";
  const textQuery = genreMatch ? normalized.replace(genreMatch[0], " ").trim() : normalized;
  return { textQuery, genreQuery };
}

function matchesMovieSearch(movie, rawSearch) {
  const { textQuery, genreQuery } = parseMovieSearchQuery(rawSearch);
  if (!textQuery && !genreQuery) return true;

  const genresHay = (Array.isArray(movie?.imdbGenres) ? movie.imdbGenres : []).join(" ").toLowerCase();
  if (genreQuery && !genresHay.includes(genreQuery)) return false;
  if (!textQuery) return true;

  const haystack = [
    movie?.title,
    movie?.synopsis,
    genresHay,
    ...(Array.isArray(movie?.imdbDirectors) ? movie.imdbDirectors : []),
    ...(Array.isArray(movie?.imdbWriters) ? movie.imdbWriters : []),
    ...(Array.isArray(movie?.imdbStars) ? movie.imdbStars : []),
    ...(Array.isArray(movie?.imdbCountries) ? movie.imdbCountries : []),
    ...(Array.isArray(movie?.imdbLanguages) ? movie.imdbLanguages : []),
    movie?.imdbId,
  ]
    .map((value) => text(value).toLowerCase())
    .join(" ");

  return haystack.includes(textQuery);
}

function filterMovieCatalogRows(movies, options = {}) {
  const filters = normalizeMovieFilterOptions(options);
  const list = Array.isArray(movies) ? movies : [];

  let scoped = list;
  if (filters.mode === "favorites") {
    scoped = scoped.filter((movie) => Boolean(movie?.isFavorite));
  } else if (filters.mode === "recent") {
    scoped = scoped
      .filter((movie) => Number(movie?.progress?.positionSeconds || 0) > 0)
      .sort((a, b) => new Date(b?.progress?.updatedAt || 0).getTime() - new Date(a?.progress?.updatedAt || 0).getTime());
  } else if (filters.mode === "watched") {
    scoped = scoped.filter((movie) => String(movie?.watchState || "") === "watched");
  }

  return scoped.filter((movie) => {
    if (filters.category) {
      const categorySlugs = Array.isArray(movie?.categorySlugs) ? movie.categorySlugs : [];
      if (!categorySlugs.includes(filters.category)) return false;
    }

    if (filters.genre) {
      const genreMatch = (Array.isArray(movie?.imdbGenres) ? movie.imdbGenres : []).some(
        (entry) => text(entry).toLowerCase() === filters.genre
      );
      if (!genreMatch) return false;
    }

    if (filters.language) {
      const languageMatch = (Array.isArray(movie?.imdbLanguages) ? movie.imdbLanguages : []).some(
        (entry) => text(entry).toLowerCase() === filters.language
      );
      if (!languageMatch) return false;
    }

    if (filters.year && String(movie?.releaseYear || "") !== filters.year) {
      return false;
    }

    if (!matchesMovieSearch(movie, filters.search)) {
      return false;
    }

    return true;
  });
}

async function loadMovieCategories(admin) {
  const { data: categories } = await admin
    .from("movie_categories")
    .select("id,slug,name,position")
    .order("position", { ascending: true })
    .order("name", { ascending: true });
  return Array.isArray(categories) ? categories : [];
}

async function loadPublishedMovieIds(admin) {
  const movieIds = [];
  let from = 0;
  while (true) {
    const to = from + DB_SCAN_PAGE_SIZE - 1;
    const { data, error } = await admin
      .from("movies")
      .select("id")
      .eq("is_published", true)
      .order("updated_at", { ascending: false })
      .range(from, to);
    if (error) throw new Error(error.message || "Failed to load published movie ids");
    const chunk = Array.isArray(data) ? data : [];
    movieIds.push(...chunk.map((row) => Number(row?.id)).filter((id) => Number.isInteger(id) && id > 0));
    if (!chunk.length) break;
    from += chunk.length;
  }
  return movieIds;
}

async function loadPublishedMovieRows(admin) {
  const rows = [];
  let from = 0;
  while (true) {
    const to = from + DB_SCAN_PAGE_SIZE - 1;
    const { data, error } = await admin
      .from("movies")
      .select(MOVIE_SELECT_COLUMNS)
      .eq("is_published", true)
      .order("updated_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, to);
    if (error) throw new Error(error.message || "Failed to load movies");
    const chunk = Array.isArray(data) ? data : [];
    rows.push(...chunk);
    if (!chunk.length) break;
    from += chunk.length;
  }
  return rows;
}

async function loadMovieCategoryMapRows(admin) {
  const rows = [];
  let offset = 0;
  while (true) {
    const { data, error } = await admin
      .from("movie_category_map")
      .select("movie_id,category_id")
      .order("movie_id", { ascending: true })
      .order("category_id", { ascending: true })
      .range(offset, offset + DB_SCAN_PAGE_SIZE - 1);
    if (error) throw new Error(error.message || "Failed to load movie/category map");
    const chunk = Array.isArray(data) ? data : [];
    rows.push(...chunk);
    if (!chunk.length) break;
    offset += chunk.length;
  }
  return rows;
}

async function loadMovieSourceRows(admin, movieIds) {
  if (!Array.isArray(movieIds) || !movieIds.length) return [];
  const { data, error } = await admin
    .from("movie_sources")
    .select("id,movie_id,label,source_url,is_active,sort_order")
    .eq("is_active", true)
    .in("movie_id", movieIds)
    .order("movie_id", { ascending: true })
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });
  if (error) throw new Error(error.message || "Failed to load movie sources");
  return Array.isArray(data) ? data : [];
}

async function loadMovieProgressRows(admin, userId, movieIds) {
  if (!userId || !Array.isArray(movieIds) || !movieIds.length) return [];
  const { data, error } = await admin
    .from("movie_watch_progress")
    .select("movie_id,position_seconds,duration_seconds,progress_percent,is_completed,updated_at")
    .eq("user_id", userId)
    .in("movie_id", movieIds);
  if (error) {
    console.error("movie progress load failed", {
      userId: String(userId || ""),
      message: String(error.message || error),
    });
    return [];
  }
  return Array.isArray(data) ? data : [];
}

async function loadMovieFavoriteRows(admin, userId, movieIds) {
  if (!userId || !Array.isArray(movieIds) || !movieIds.length) return [];
  const { data, error } = await admin
    .from("movie_favorites")
    .select("movie_id")
    .eq("user_id", userId)
    .in("movie_id", movieIds);
  if (error) {
    console.error("movie favorites load failed", {
      userId: String(userId || ""),
      message: String(error.message || error),
    });
    return [];
  }
  return Array.isArray(data) ? data : [];
}

async function hydrateMoviesForUser(admin, userId, movieRows, options = {}) {
  const rows = Array.isArray(movieRows) ? movieRows : [];
  if (!rows.length) return [];

  const requestedOrder = Array.isArray(options?.orderIds) ? options.orderIds : [];
  const movieIds = rows.map((row) => Number(row?.id)).filter((id) => Number.isInteger(id) && id > 0);
  const movieIdSet = new Set(movieIds);

  const [categories, mapRows, sourceRows, progressRows, favoriteRows] = await Promise.all([
    loadMovieCategories(admin),
    loadMovieCategoryMapRows(admin),
    loadMovieSourceRows(admin, movieIds),
    loadMovieProgressRows(admin, userId, movieIds),
    loadMovieFavoriteRows(admin, userId, movieIds),
  ]);

  const categoryById = new Map(
    categories.map((row) => [
      Number(row?.id),
      {
        id: String(row?.id || ""),
        slug: normalizeCategorySlug(row?.slug || row?.name || ""),
        name: text(row?.name) || "Category",
      },
    ])
  );

  const categoriesByMovie = new Map();
  for (const row of mapRows) {
    const movieId = Number(row?.movie_id);
    const categoryId = Number(row?.category_id);
    if (!Number.isInteger(movieId) || !Number.isInteger(categoryId) || !movieIdSet.has(movieId)) continue;
    const category = categoryById.get(categoryId);
    if (!category) continue;
    const list = categoriesByMovie.get(movieId) || [];
    list.push(category);
    categoriesByMovie.set(movieId, list);
  }

  const sourcesByMovie = new Map();
  for (const row of sourceRows) {
    const movieId = Number(row?.movie_id);
    if (!Number.isInteger(movieId) || !movieIdSet.has(movieId)) continue;
    const list = sourcesByMovie.get(movieId) || [];
    list.push(row);
    sourcesByMovie.set(movieId, list);
  }

  const progressByMovie = new Map();
  for (const row of progressRows) {
    const movieId = Number(row?.movie_id);
    if (!Number.isInteger(movieId)) continue;
    progressByMovie.set(movieId, row);
  }

  const favoriteSet = new Set(
    favoriteRows
      .map((row) => Number(row?.movie_id))
      .filter((movieId) => Number.isInteger(movieId) && movieId > 0)
  );

  const rawMovies = rows.map((movie) =>
    toMovieShape(
      movie,
      categoriesByMovie.get(Number(movie.id)) || [],
      sourcesByMovie.get(Number(movie.id)) || [],
      progressByMovie.get(Number(movie.id)) || null,
      favoriteSet.has(Number(movie.id))
    )
  );

  if (!requestedOrder.length) return rawMovies;
  const orderMap = new Map(requestedOrder.map((id, index) => [Number(id), index]));
  return rawMovies.toSorted((a, b) => (orderMap.get(Number(a?.id)) ?? 0) - (orderMap.get(Number(b?.id)) ?? 0));
}

async function loadCategoryListWithCounts(admin) {
  const [categories, publishedMovieIds, mapRows] = await Promise.all([
    loadMovieCategories(admin),
    loadPublishedMovieIds(admin),
    loadMovieCategoryMapRows(admin),
  ]);

  const publishedSet = new Set(publishedMovieIds);
  const countsByCategoryId = new Map();
  for (const row of mapRows) {
    const movieId = Number(row?.movie_id);
    const categoryId = Number(row?.category_id);
    if (!Number.isInteger(movieId) || !Number.isInteger(categoryId) || !publishedSet.has(movieId)) continue;
    countsByCategoryId.set(categoryId, (countsByCategoryId.get(categoryId) || 0) + 1);
  }

  return categories.map((row) => {
    const slug = normalizeCategorySlug(row?.slug || row?.name || "");
    return {
      id: String(row?.id || ""),
      slug,
      name: text(row?.name) || "Category",
      count: Number(countsByCategoryId.get(Number(row?.id)) || 0),
    };
  });
}

async function loadContinueWatchingForUser(admin, userId, limit = 20) {
  if (!userId) return [];
  const { data, error } = await admin
    .from("movie_watch_progress")
    .select("movie_id,position_seconds,duration_seconds,progress_percent,is_completed,updated_at")
    .eq("user_id", userId)
    .eq("is_completed", false)
    .gt("position_seconds", 0)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("movie continue watching load failed", {
      userId: String(userId || ""),
      message: String(error.message || error),
    });
    return [];
  }

  const progressRows = Array.isArray(data) ? data : [];
  const movieIds = progressRows
    .map((row) => Number(row?.movie_id))
    .filter((movieId) => Number.isInteger(movieId) && movieId > 0);
  if (!movieIds.length) return [];

  const { data: movieRows, error: movieErr } = await admin
    .from("movies")
    .select(MOVIE_SELECT_COLUMNS)
    .eq("is_published", true)
    .in("id", movieIds);
  if (movieErr) throw new Error(movieErr.message || "Failed to load continue watching movies");

  return hydrateMoviesForUser(admin, userId, movieRows || [], { orderIds: movieIds });
}

async function loadMovieSidebarSummaryForUser(admin, userId) {
  const rows = [];
  let from = 0;
  while (true) {
    const to = from + DB_SCAN_PAGE_SIZE - 1;
    const { data, error } = await admin
      .from("movies")
      .select("id,release_year,imdb_genres,imdb_languages")
      .eq("is_published", true)
      .order("updated_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, to);
    if (error) throw new Error(error.message || "Failed to load movie sidebar summary");
    const chunk = Array.isArray(data) ? data : [];
    rows.push(...chunk);
    if (!chunk.length) break;
    from += chunk.length;
  }

  const publishedMovieIds = rows
    .map((row) => Number(row?.id))
    .filter((movieId) => Number.isInteger(movieId) && movieId > 0);
  const publishedSet = new Set(publishedMovieIds);
  const genresByKey = new Map();
  const languagesByKey = new Map();
  const yearsByKey = new Map();

  for (const row of rows) {
    for (const rawGenre of Array.isArray(row?.imdb_genres) ? row.imdb_genres : []) {
      const name = String(rawGenre || "").trim();
      const key = name.toLowerCase();
      if (!key) continue;
      const current = genresByKey.get(key);
      genresByKey.set(key, current ? { ...current, count: current.count + 1 } : { key, name, count: 1 });
    }

    for (const rawLanguage of Array.isArray(row?.imdb_languages) ? row.imdb_languages : []) {
      const name = String(rawLanguage || "").trim();
      const key = name.toLowerCase();
      if (!key) continue;
      const current = languagesByKey.get(key);
      languagesByKey.set(key, current ? { ...current, count: current.count + 1 } : { key, name, count: 1 });
    }

    const year = Number(row?.release_year || 0);
    if (Number.isFinite(year) && year > 0) {
      const key = String(Math.floor(year));
      yearsByKey.set(key, (yearsByKey.get(key) || 0) + 1);
    }
  }

  const [progressRows, favoriteRows] = await Promise.all([
    userId
      ? admin
          .from("movie_watch_progress")
          .select("movie_id,position_seconds,progress_percent,is_completed")
          .eq("user_id", userId)
      : Promise.resolve({ data: [] }),
    userId ? admin.from("movie_favorites").select("movie_id").eq("user_id", userId) : Promise.resolve({ data: [] }),
  ]);

  const recentMovieIds = new Set();
  const watchedMovieIds = new Set();
  for (const row of Array.isArray(progressRows?.data) ? progressRows.data : []) {
    const movieId = Number(row?.movie_id);
    if (!publishedSet.has(movieId)) continue;
    const positionSeconds = Number(row?.position_seconds || 0);
    const progressPercent = Number(row?.progress_percent || 0);
    const isCompleted = Boolean(row?.is_completed) || progressPercent >= 95;
    if (positionSeconds > 0) recentMovieIds.add(movieId);
    if (isCompleted) watchedMovieIds.add(movieId);
  }

  const favoriteMovieIds = new Set();
  for (const row of Array.isArray(favoriteRows?.data) ? favoriteRows.data : []) {
    const movieId = Number(row?.movie_id);
    if (!publishedSet.has(movieId)) continue;
    favoriteMovieIds.add(movieId);
  }

  return {
    stats: {
      all: publishedMovieIds.length,
      favorites: favoriteMovieIds.size,
      recent: recentMovieIds.size,
      watched: watchedMovieIds.size,
    },
    genres: Array.from(genresByKey.values()).sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" })),
    languages: Array.from(languagesByKey.values()).sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
    ),
    years: Array.from(yearsByKey.entries())
      .map(([key, count]) => ({ key, name: key, count }))
      .sort((a, b) => Number(b.key) - Number(a.key)),
  };
}

export async function getMovieBySlugForUser(userId, slug) {
  const normalizedSlug = text(slug).toLowerCase();
  if (!normalizedSlug) return null;

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("movies")
    .select(MOVIE_SELECT_COLUMNS)
    .eq("is_published", true)
    .eq("slug", normalizedSlug)
    .maybeSingle();
  if (error || !data?.id) return null;

  const movies = await hydrateMoviesForUser(admin, userId, [data]);
  return movies[0] || null;
}

export async function getMoviesPageForUser(userId, options = {}) {
  const filters = normalizeMovieFilterOptions(options);
  const admin = getSupabaseAdmin();
  const page = clampPage(options?.page);
  const pageSize = clampPageSize(options?.pageSize);

  if (hasMoviePageFilters(filters)) {
    const [movieRows, categories, mapRows, progressRes, favoriteRes] = await Promise.all([
      loadPublishedMovieRows(admin),
      loadMovieCategories(admin),
      loadMovieCategoryMapRows(admin),
      userId
        ? admin
            .from("movie_watch_progress")
            .select("movie_id,position_seconds,duration_seconds,progress_percent,is_completed,updated_at")
            .eq("user_id", userId)
        : Promise.resolve({ data: [] }),
      userId ? admin.from("movie_favorites").select("movie_id").eq("user_id", userId) : Promise.resolve({ data: [] }),
    ]);

    const categoryById = new Map(
      categories.map((row) => [Number(row?.id), normalizeCategorySlug(row?.slug || row?.name || "")])
    );
    const categorySlugsByMovie = new Map();
    for (const row of mapRows) {
      const movieId = Number(row?.movie_id);
      const categorySlug = categoryById.get(Number(row?.category_id));
      if (!Number.isInteger(movieId) || !categorySlug) continue;
      const list = categorySlugsByMovie.get(movieId) || [];
      list.push(categorySlug);
      categorySlugsByMovie.set(movieId, list);
    }

    const progressByMovie = new Map();
    for (const row of Array.isArray(progressRes?.data) ? progressRes.data : []) {
      const movieId = Number(row?.movie_id);
      if (!Number.isInteger(movieId)) continue;
      progressByMovie.set(movieId, row);
    }

    const favoriteSet = new Set(
      (Array.isArray(favoriteRes?.data) ? favoriteRes.data : [])
        .map((row) => Number(row?.movie_id))
        .filter((movieId) => Number.isInteger(movieId))
    );

    const filteredRows = movieRows
      .map((row) => {
        const movieId = Number(row?.id);
        const progress = progressByMovie.get(movieId) || null;
        const progressPercent = Number(progress?.progress_percent || 0);
        const isCompleted = Boolean(progress?.is_completed) || progressPercent >= 95;
        return {
          row,
          movieId,
          title: text(row?.title),
          synopsis: text(row?.synopsis),
          categorySlugs: categorySlugsByMovie.get(movieId) || [],
          imdbGenres: toStringList(row?.imdb_genres),
          imdbDirectors: toStringList(row?.imdb_directors),
          imdbWriters: toStringList(row?.imdb_writers),
          imdbStars: toStringList(row?.imdb_stars),
          imdbCountries: toStringList(row?.imdb_countries),
          imdbLanguages: toStringList(row?.imdb_languages),
          imdbId: text(row?.imdb_id),
          releaseYear: Number.isFinite(Number(row?.release_year)) ? Number(row.release_year) : null,
          isFavorite: favoriteSet.has(movieId),
          positionSeconds: Number(progress?.position_seconds || 0),
          progressPercent,
          watchState: deriveWatchState({
            positionSeconds: Number(progress?.position_seconds || 0),
            progressPercent: isCompleted ? 100 : progressPercent,
          }),
          progressUpdatedAt: text(progress?.updated_at),
        };
      })
      .filter((movie) => {
        if (filters.mode === "favorites" && !movie.isFavorite) return false;
        if (filters.mode === "recent" && movie.positionSeconds <= 0) return false;
        if (filters.mode === "watched" && movie.watchState !== "watched") return false;
        if (filters.category && !movie.categorySlugs.includes(filters.category)) return false;
        if (filters.genre && !movie.imdbGenres.some((entry) => text(entry).toLowerCase() === filters.genre)) return false;
        if (filters.language && !movie.imdbLanguages.some((entry) => text(entry).toLowerCase() === filters.language)) return false;
        if (filters.year && String(movie.releaseYear || "") !== filters.year) return false;
        if (!matchesMovieSearch(movie, filters.search)) return false;
        return true;
      });

    const orderedRows =
      filters.mode === "recent"
        ? filteredRows.toSorted(
            (a, b) => new Date(b.progressUpdatedAt || 0).getTime() - new Date(a.progressUpdatedAt || 0).getTime()
          )
        : filteredRows;

    const total = orderedRows.length;
    const from = (page - 1) * pageSize;
    const pagedRows = orderedRows.slice(from, from + pageSize);
    const pagedMovieRows = pagedRows.map((item) => item.row);
    const pagedOrderIds = pagedRows.map((item) => item.movieId);
    const pagedMovies = await hydrateMoviesForUser(admin, userId, pagedMovieRows, { orderIds: pagedOrderIds });
    return {
      movies: pagedMovies,
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await admin
    .from("movies")
    .select(MOVIE_SELECT_COLUMNS, { count: "exact" })
    .eq("is_published", true)
    .order("updated_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, to);
  if (error) throw new Error(error.message || "Failed to load movies");

  const movies = await hydrateMoviesForUser(admin, userId, data || []);
  return {
    movies,
    page,
    pageSize,
    total: Number(count || 0),
    totalPages: Math.max(1, Math.ceil(Number(count || 0) / pageSize)),
  };
}

export async function getMovieCatalogBootstrapForUser(userId, options = {}) {
  const admin = getSupabaseAdmin();
  const includePage = options?.includePage !== false;
  const page = clampPage(options?.page);
  const pageSize = clampPageSize(options?.pageSize);

  const [categories, continueWatching, pageData, sidebar] = await Promise.all([
    loadCategoryListWithCounts(admin),
    loadContinueWatchingForUser(admin, userId, 20),
    includePage ? getMoviesPageForUser(userId, { ...options, page, pageSize }) : Promise.resolve(null),
    loadMovieSidebarSummaryForUser(admin, userId),
  ]);

  return {
    categories,
    continueWatching,
    stats: sidebar.stats,
    genres: sidebar.genres,
    languages: sidebar.languages,
    years: sidebar.years,
    page: pageData || {
      movies: [],
      page,
      pageSize,
      total: 0,
      totalPages: 1,
    },
  };
}

export async function getMoviesCatalogForUser(userId) {
  const admin = getSupabaseAdmin();
  const movieRows = [];
  let from = 0;
  while (true) {
    const to = from + DB_SCAN_PAGE_SIZE - 1;
    const { data, error } = await admin
      .from("movies")
      .select(MOVIE_SELECT_COLUMNS)
      .eq("is_published", true)
      .order("updated_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, to);
    if (error) throw new Error(error.message || "Failed to load movies");
    const chunk = Array.isArray(data) ? data : [];
    movieRows.push(...chunk);
    if (!chunk.length) break;
    from += chunk.length;
  }

  const [movies, categories, continueWatching] = await Promise.all([
    hydrateMoviesForUser(admin, userId, movieRows),
    loadCategoryListWithCounts(admin),
    loadContinueWatchingForUser(admin, userId, 20),
  ]);

  return { movies, categories, continueWatching };
}
