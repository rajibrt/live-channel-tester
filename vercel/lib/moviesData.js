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
      slug: text(row?.slug),
      name: text(row?.name) || "Category",
    })),
    categorySlugs: (Array.isArray(categoryRows) ? categoryRows : []).map((row) => text(row?.slug)).filter(Boolean),
    source: firstSource
      ? {
          id: String(firstSource.id),
          label: text(firstSource.label) || "default",
          rawUrl: normalizedSource,
          playbackUrl,
        }
      : null,
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
        slug: text(row?.slug) || normalizeCategorySlug(row?.name),
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
    const slug = text(row?.slug) || normalizeCategorySlug(row?.name);
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
  const admin = getSupabaseAdmin();
  const page = clampPage(options?.page);
  const pageSize = clampPageSize(options?.pageSize);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await admin
    .from("movies")
    .select(MOVIE_SELECT_COLUMNS, { count: "exact" })
    .eq("is_published", true)
    .order("updated_at", { ascending: false })
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

  const [categories, continueWatching, pageData] = await Promise.all([
    loadCategoryListWithCounts(admin),
    loadContinueWatchingForUser(admin, userId, 20),
    includePage ? getMoviesPageForUser(userId, { page, pageSize }) : Promise.resolve(null),
  ]);

  return {
    categories,
    continueWatching,
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
