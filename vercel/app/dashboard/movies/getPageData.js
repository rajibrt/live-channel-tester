import { getSupabaseAdmin } from "../../../lib/supabaseAdmin";

export async function getMoviesPageData() {
  const admin = getSupabaseAdmin();
  const categoriesPromise = admin
    .from("movie_categories")
    .select("id,slug,name,position,updated_at")
    .order("position", { ascending: true });

  const moviesPromise = (async () => {
    const pageSize = 500;
    const rows = [];
    let from = 0;
    while (true) {
      const to = from + pageSize - 1;
      const { data, error } = await admin
        .from("movies")
        .select(
          "id,slug,title,synopsis,poster_url,backdrop_url,release_year,runtime_seconds,is_published,updated_at,imdb_id,imdb_url,imdb_rating,imdb_votes,content_rating,imdb_genres,imdb_directors,imdb_writers,imdb_stars,imdb_release_date,imdb_countries,imdb_languages,video_quality"
        )
        .order("updated_at", { ascending: false })
        .range(from, to);
      if (error) throw new Error(error.message || "Failed to load movies");
      const chunk = Array.isArray(data) ? data : [];
      rows.push(...chunk);
      if (!chunk.length) break;
      from += chunk.length;
    }
    return rows;
  })();

  const mapPromise = (async () => {
    const pageSize = 500;
    const rows = [];
    let from = 0;
    while (true) {
      const to = from + pageSize - 1;
      const { data, error } = await admin
        .from("movie_category_map")
        .select("movie_id,category_id")
        .order("movie_id", { ascending: true })
        .order("category_id", { ascending: true })
        .range(from, to);
      if (error) throw new Error(error.message || "Failed to load movie/category map");
      const chunk = Array.isArray(data) ? data : [];
      rows.push(...chunk);
      if (!chunk.length) break;
      from += chunk.length;
    }
    return rows;
  })();

  const sourcesPromise = (async () => {
    const pageSize = 500;
    const rows = [];
    let from = 0;
    while (true) {
      const to = from + pageSize - 1;
      const { data, error } = await admin
        .from("movie_sources")
        .select("id,movie_id,label,source_url,is_active,sort_order")
        .order("movie_id", { ascending: true })
        .order("sort_order", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to);
      if (error) throw new Error(error.message || "Failed to load movie sources");
      const chunk = Array.isArray(data) ? data : [];
      rows.push(...chunk);
      if (!chunk.length) break;
      from += chunk.length;
    }
    return rows;
  })();

  const [categoriesRes, movies, mapRows, sourceRows] = await Promise.all([
    categoriesPromise,
    moviesPromise,
    mapPromise,
    sourcesPromise,
  ]);

  const categories = categoriesRes.data || [];
  const categoryById = new Map(categories.map((row) => [Number(row.id), row]));

  const categoriesByMovie = new Map();
  for (const row of mapRows || []) {
    const movieId = Number(row?.movie_id);
    const category = categoryById.get(Number(row?.category_id));
    if (!movieId || !category) continue;
    const list = categoriesByMovie.get(movieId) || [];
    list.push({ id: String(category.id), slug: String(category.slug || ""), name: String(category.name || "") });
    categoriesByMovie.set(movieId, list);
  }

  const sourcesByMovie = new Map();
  for (const row of sourceRows || []) {
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
