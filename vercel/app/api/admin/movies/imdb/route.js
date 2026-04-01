import { NextResponse } from "next/server";
import { requireAdminApi } from "../../../../../lib/adminApi";
import { fetchMovieMetadataByImdbIdWithFallback } from "../../../../../lib/movieMetadataByImdb";
import { normalizeImdbId } from "../../../../../lib/imdbData";
import { fetchMovieMetadataByTitle, searchMovieMetadataCandidatesByTitle } from "../../../../../lib/movieMetadataProvider";

export async function POST(request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const payload = await request.json().catch(() => ({}));
  const mode = String(payload?.mode || "").trim().toLowerCase();
  const query = String(payload?.query || payload?.imdb_id || "").trim();
  if (!query) {
    return NextResponse.json({ error: "Query is required" }, { status: 400 });
  }

  if (mode === "search_title") {
    try {
      const candidates = await searchMovieMetadataCandidatesByTitle({
        title: query,
        year: payload?.year,
        limit: payload?.limit,
      });
      return NextResponse.json({
        ok: true,
        mode,
        query,
        candidates,
      });
    } catch (error) {
      return NextResponse.json(
        {
          error: error?.message || "Failed to search metadata candidates",
          candidates: [],
        },
        { status: 422 }
      );
    }
  }

  if (mode === "fetch_title") {
    try {
      const result = await fetchMovieMetadataByTitle({
        title: query,
        year: payload?.year,
        providers: Array.isArray(payload?.providers) ? payload.providers : ["imdb", "omdb", "tmdb"],
      });
      return NextResponse.json({ ok: true, item: result, provider: result?.provider || "unknown" });
    } catch (error) {
      return NextResponse.json(
        {
          error: error?.message || "Failed to fetch title metadata",
        },
        { status: 422 }
      );
    }
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
