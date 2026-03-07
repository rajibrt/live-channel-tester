import { NextResponse } from "next/server";
import { requireAdminApi } from "../../../../../lib/adminApi";
import { fetchMovieMetadataByImdbIdWithFallback } from "../../../../../lib/movieMetadataByImdb";
import { normalizeImdbId } from "../../../../../lib/imdbData";

export async function POST(request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const payload = await request.json().catch(() => ({}));
  const query = String(payload?.query || payload?.imdb_id || "").trim();
  if (!query) {
    return NextResponse.json({ error: "IMDb ID is required" }, { status: 400 });
  }

  try {
    const result = await fetchMovieMetadataByImdbIdWithFallback(query, auth.current.user.id);
    return NextResponse.json(result);
  } catch (error) {
    const imdbId = normalizeImdbId(query);
    return NextResponse.json(
      {
        error: error?.message || "Failed to fetch IMDb data",
        imdb_id: imdbId || "",
      },
      { status: 422 }
    );
  }
}
