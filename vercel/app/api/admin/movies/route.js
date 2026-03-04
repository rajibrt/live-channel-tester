import { NextResponse } from "next/server";
import { requireAdminApi } from "../../../../lib/adminApi";
import { getSupabaseAdmin } from "../../../../lib/supabaseAdmin";
import { normalizeStreamUrl } from "../../../../lib/streamUrl";
import { csvToList, normalizeImdbId } from "../../../../lib/imdbData";
import { detectVideoQualityLabel } from "../../../../lib/videoQuality";

function toInt(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.floor(n));
}

function toSlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toDecimal(value, fallback = null) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const fixed = Math.max(0, Math.min(10, Math.round(n * 10) / 10));
  return Number.isFinite(fixed) ? fixed : fallback;
}

async function loadMovies(admin) {
  const { data: movies, error } = await admin
    .from("movies")
    .select(
      "id,slug,title,synopsis,poster_url,backdrop_url,release_year,runtime_seconds,is_published,updated_at,imdb_id,imdb_url,imdb_rating,imdb_votes,content_rating,imdb_genres,imdb_directors,imdb_writers,imdb_stars,imdb_release_date,imdb_countries,imdb_languages,video_quality"
    )
    .order("updated_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message || "Failed to load movies");

  const ids = (movies || []).map((row) => Number(row?.id)).filter((id) => Number.isInteger(id) && id > 0);
  if (!ids.length) return [];

  const [mapRes, categoryRes, sourceRes] = await Promise.all([
    admin.from("movie_category_map").select("movie_id,category_id").in("movie_id", ids),
    admin.from("movie_categories").select("id,slug,name").order("position", { ascending: true }),
    admin
      .from("movie_sources")
      .select("id,movie_id,label,source_url,is_active,sort_order")
      .in("movie_id", ids)
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true }),
  ]);

  const categoryById = new Map((categoryRes.data || []).map((row) => [Number(row.id), row]));
  const categoryMapByMovie = new Map();
  for (const row of mapRes.data || []) {
    const movieId = Number(row?.movie_id);
    const categoryId = Number(row?.category_id);
    if (!movieId || !categoryId) continue;
    const category = categoryById.get(categoryId);
    if (!category) continue;
    const list = categoryMapByMovie.get(movieId) || [];
    list.push({ id: String(category.id), slug: String(category.slug || ""), name: String(category.name || "") });
    categoryMapByMovie.set(movieId, list);
  }

  const sourceByMovie = new Map();
  for (const row of sourceRes.data || []) {
    const movieId = Number(row?.movie_id);
    if (!movieId) continue;
    const list = sourceByMovie.get(movieId) || [];
    list.push(row);
    sourceByMovie.set(movieId, list);
  }

  return (movies || []).map((row) => ({
    ...row,
    categories: categoryMapByMovie.get(Number(row.id)) || [],
    sources: sourceByMovie.get(Number(row.id)) || [],
  }));
}

export async function GET() {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  try {
    const admin = getSupabaseAdmin();
    const items = await loadMovies(admin);
    return NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json({ error: error?.message || "Failed to load movies" }, { status: 500 });
  }
}

export async function POST(request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const payload = await request.json().catch(() => ({}));
  const title = String(payload?.title || "").trim();
  const slug = toSlug(payload?.slug || title);
  const synopsis = String(payload?.synopsis || "").trim();
  const posterUrl = String(payload?.poster_url || "").trim();
  const backdropUrl = String(payload?.backdrop_url || "").trim();
  const releaseYear = toInt(payload?.release_year, 0) || null;
  const runtimeSeconds = toInt(payload?.runtime_seconds, 0);
  const isPublished = Boolean(payload?.is_published ?? true);
  const sourceUrl = normalizeStreamUrl(payload?.source_url);
  const imdbId = normalizeImdbId(payload?.imdb_id);
  const imdbUrl = String(payload?.imdb_url || "").trim();
  const imdbRating = toDecimal(payload?.imdb_rating, null);
  const imdbVotes = toInt(payload?.imdb_votes, 0) || null;
  const contentRating = String(payload?.content_rating || "").trim();
  const imdbGenres = Array.isArray(payload?.imdb_genres) ? payload.imdb_genres : csvToList(payload?.imdb_genres);
  const imdbDirectors = Array.isArray(payload?.imdb_directors) ? payload.imdb_directors : csvToList(payload?.imdb_directors);
  const imdbWriters = Array.isArray(payload?.imdb_writers) ? payload.imdb_writers : csvToList(payload?.imdb_writers);
  const imdbStars = Array.isArray(payload?.imdb_stars) ? payload.imdb_stars : csvToList(payload?.imdb_stars);
  const imdbReleaseDate = String(payload?.imdb_release_date || "").trim();
  const imdbCountries = Array.isArray(payload?.imdb_countries) ? payload.imdb_countries : csvToList(payload?.imdb_countries);
  const imdbLanguages = Array.isArray(payload?.imdb_languages) ? payload.imdb_languages : csvToList(payload?.imdb_languages);
  const videoQualityInput = String(payload?.video_quality || "").trim().toUpperCase();
  const categoryIds = Array.isArray(payload?.category_ids)
    ? payload.category_ids.map((v) => Number(v)).filter((v) => Number.isInteger(v) && v > 0)
    : [];

  if (!title || !slug) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const now = new Date().toISOString();
  const detectedVideoQuality = await detectVideoQualityLabel(sourceUrl);
  const videoQuality = detectedVideoQuality || videoQualityInput;
  const { data: movieRow, error: movieErr } = await admin
    .from("movies")
    .upsert(
      {
        slug,
        title,
        synopsis,
        poster_url: posterUrl,
        backdrop_url: backdropUrl,
        release_year: releaseYear,
        runtime_seconds: runtimeSeconds,
        is_published: isPublished,
        imdb_id: imdbId || null,
        imdb_url: imdbUrl,
        imdb_rating: imdbRating,
        imdb_votes: imdbVotes,
        content_rating: contentRating,
        imdb_genres: imdbGenres,
        imdb_directors: imdbDirectors,
        imdb_writers: imdbWriters,
        imdb_stars: imdbStars,
        imdb_release_date: imdbReleaseDate,
        imdb_countries: imdbCountries,
        imdb_languages: imdbLanguages,
        video_quality: videoQuality,
        updated_at: now,
      },
      { onConflict: "slug" }
    )
    .select("id")
    .single();

  if (movieErr || !movieRow?.id) {
    return NextResponse.json({ error: movieErr?.message || "Failed to save movie" }, { status: 500 });
  }

  const movieId = Number(movieRow.id);

  await admin.from("movie_category_map").delete().eq("movie_id", movieId);
  if (categoryIds.length) {
    const rows = [...new Set(categoryIds)].map((categoryId) => ({ movie_id: movieId, category_id: categoryId }));
    const { error: mapErr } = await admin.from("movie_category_map").insert(rows);
    if (mapErr) return NextResponse.json({ error: mapErr.message || "Failed to save categories" }, { status: 500 });
  }

  await admin.from("movie_sources").delete().eq("movie_id", movieId);
  if (sourceUrl) {
    const { error: sourceErr } = await admin.from("movie_sources").insert({
      movie_id: movieId,
      label: "default",
      source_url: sourceUrl,
      is_active: true,
      sort_order: 0,
      updated_at: now,
    });
    if (sourceErr) return NextResponse.json({ error: sourceErr.message || "Failed to save source" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: String(movieId) });
}
