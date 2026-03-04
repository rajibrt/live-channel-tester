import { getSupabaseAdmin } from "../../../lib/supabaseAdmin";

export async function getMoviesPageData() {
  const admin = getSupabaseAdmin();
  const [categoriesRes, moviesRes, mapRes, sourcesRes] = await Promise.all([
    admin.from("movie_categories").select("id,slug,name,position,updated_at").order("position", { ascending: true }),
    admin
      .from("movies")
      .select(
        "id,slug,title,synopsis,poster_url,backdrop_url,release_year,runtime_seconds,is_published,updated_at,imdb_id,imdb_url,imdb_rating,imdb_votes,content_rating,imdb_genres,imdb_directors,imdb_writers,imdb_stars,imdb_release_date,imdb_countries,imdb_languages,video_quality"
      )
      .order("updated_at", { ascending: false })
      .limit(500),
    admin.from("movie_category_map").select("movie_id,category_id"),
    admin
      .from("movie_sources")
      .select("id,movie_id,label,source_url,is_active,sort_order")
      .order("movie_id", { ascending: true })
      .order("sort_order", { ascending: true }),
  ]);

  const categories = categoriesRes.data || [];
  const movies = moviesRes.data || [];
  const categoryById = new Map(categories.map((row) => [Number(row.id), row]));

  const categoriesByMovie = new Map();
  for (const row of mapRes.data || []) {
    const movieId = Number(row?.movie_id);
    const category = categoryById.get(Number(row?.category_id));
    if (!movieId || !category) continue;
    const list = categoriesByMovie.get(movieId) || [];
    list.push({ id: String(category.id), slug: String(category.slug || ""), name: String(category.name || "") });
    categoriesByMovie.set(movieId, list);
  }

  const sourcesByMovie = new Map();
  for (const row of sourcesRes.data || []) {
    const movieId = Number(row?.movie_id);
    if (!movieId) continue;
    const list = sourcesByMovie.get(movieId) || [];
    list.push(row);
    sourcesByMovie.set(movieId, list);
  }

  const mergedMovies = movies.map((row) => ({
    ...row,
    categories: categoriesByMovie.get(Number(row.id)) || [],
    sources: sourcesByMovie.get(Number(row.id)) || [],
  }));

  return { categories, movies: mergedMovies };
}
