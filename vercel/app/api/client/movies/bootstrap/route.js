import { NextResponse } from "next/server";
import { requireClientApi } from "../../../../../lib/clientApi";
import { getMovieCatalogBootstrapForUser } from "../../../../../lib/moviesData";

function toPositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value || ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

export async function GET(request) {
  const auth = await requireClientApi();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const page = toPositiveInt(searchParams.get("page"), 1);
  const pageSize = toPositiveInt(searchParams.get("pageSize"), 24);
  const data = await getMovieCatalogBootstrapForUser(auth.current.user.id, {
    page,
    pageSize,
    mode: String(searchParams.get("mode") || ""),
    category: String(searchParams.get("category") || ""),
    genre: String(searchParams.get("genre") || ""),
    language: String(searchParams.get("language") || ""),
    year: String(searchParams.get("year") || ""),
    search: String(searchParams.get("search") || ""),
  });
  return NextResponse.json({
    movies: data.page.movies,
    page: data.page.page,
    pageSize: data.page.pageSize,
    total: data.page.total,
    totalPages: data.page.totalPages,
    stats: data.stats,
    categories: data.categories,
    genres: data.genres,
    languages: data.languages,
    years: data.years,
    continueWatching: data.continueWatching,
  });
}
