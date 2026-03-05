import { getSupabaseAdmin } from "./supabaseAdmin";
import { normalizeStreamUrl } from "./streamUrl";
import { deriveWatchState, isWatchedProgress, normalizeSeconds } from "./movieProgress";
import { inferVideoQualityLabelFromUrl } from "./videoQuality";

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
  const playbackUrl = normalizedSource || "";

  const watchState = deriveWatchState({
    positionSeconds,
    progressPercent: isCompleted ? 100 : clampedProgress,
  });

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
    imdbLanguages: toStringList(movie?.imdb_languages),
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

export async function getMoviesCatalogForUser(userId) {
  const admin = getSupabaseAdmin();

  const { data: movieRows, error: movieErr } = await admin
    .from("movies")
    .select(
      "id,slug,title,synopsis,poster_url,backdrop_url,release_year,runtime_seconds,is_published,updated_at,imdb_id,imdb_url,imdb_rating,imdb_votes,content_rating,imdb_genres,imdb_directors,imdb_writers,imdb_stars,imdb_release_date,imdb_countries,imdb_languages,video_quality"
    )
    .eq("is_published", true)
    .order("updated_at", { ascending: false })
    .limit(500);

  if (movieErr || !Array.isArray(movieRows) || !movieRows.length) {
    const { data: categories } = await admin
      .from("movie_categories")
      .select("id,slug,name,position")
      .order("position", { ascending: true })
      .order("name", { ascending: true });

    return {
      movies: [],
      categories: (categories || []).map((row) => ({
        id: String(row?.id || ""),
        slug: text(row?.slug),
        name: text(row?.name) || "Category",
        count: 0,
      })),
      continueWatching: [],
    };
  }

  const movieIds = movieRows.map((row) => Number(row?.id)).filter((id) => Number.isInteger(id) && id > 0);

  const [categoriesRes, mapRes, sourcesRes, progressRes, favoritesRes] = await Promise.all([
    admin
      .from("movie_categories")
      .select("id,slug,name,position")
      .order("position", { ascending: true })
      .order("name", { ascending: true }),
    admin
      .from("movie_category_map")
      .select("movie_id,category_id")
      .in("movie_id", movieIds),
    admin
      .from("movie_sources")
      .select("id,movie_id,label,source_url,is_active,sort_order")
      .in("movie_id", movieIds)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true }),
    userId
      ? admin
          .from("movie_watch_progress")
          .select("movie_id,position_seconds,duration_seconds,progress_percent,is_completed,updated_at")
          .eq("user_id", userId)
      : Promise.resolve({ data: [] }),
    userId
      ? admin.from("movie_favorites").select("movie_id").eq("user_id", userId)
      : Promise.resolve({ data: [] }),
  ]);

  const categories = Array.isArray(categoriesRes?.data) ? categoriesRes.data : [];
  const mapRows = Array.isArray(mapRes?.data) ? mapRes.data : [];
  const sourceRows = Array.isArray(sourcesRes?.data) ? sourcesRes.data : [];
  const progressRows = Array.isArray(progressRes?.data) ? progressRes.data : [];
  const favoriteRows = Array.isArray(favoritesRes?.data) ? favoritesRes.data : [];

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
    if (!Number.isInteger(movieId) || !Number.isInteger(categoryId)) continue;
    const category = categoryById.get(categoryId);
    if (!category) continue;
    const list = categoriesByMovie.get(movieId) || [];
    list.push(category);
    categoriesByMovie.set(movieId, list);
  }

  const sourcesByMovie = new Map();
  for (const row of sourceRows) {
    const movieId = Number(row?.movie_id);
    if (!Number.isInteger(movieId)) continue;
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

  const movies = movieRows.map((movie) =>
    toMovieShape(
      movie,
      categoriesByMovie.get(Number(movie.id)) || [],
      sourcesByMovie.get(Number(movie.id)) || [],
      progressByMovie.get(Number(movie.id)) || null,
      favoriteSet.has(Number(movie.id))
    )
  );

  const countsByCategorySlug = new Map();
  for (const movie of movies) {
    for (const slug of movie.categorySlugs) {
      if (!slug) continue;
      countsByCategorySlug.set(slug, (countsByCategorySlug.get(slug) || 0) + 1);
    }
  }

  const categoryList = categories.map((row) => {
    const slug = text(row?.slug) || normalizeCategorySlug(row?.name);
    return {
      id: String(row?.id || ""),
      slug,
      name: text(row?.name) || "Category",
      count: Number(countsByCategorySlug.get(slug) || 0),
    };
  });

  const continueWatching = movies
    .filter((movie) => movie.watchState === "continue")
    .sort((a, b) => new Date(b.progress.updatedAt || 0).getTime() - new Date(a.progress.updatedAt || 0).getTime())
    .slice(0, 20);

  return {
    movies,
    categories: categoryList,
    continueWatching,
  };
}
