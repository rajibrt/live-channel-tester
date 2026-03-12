import { NextResponse } from "next/server";
import { requireClientApi } from "../../../../../lib/clientApi";
import { getMovieCatalogBootstrapForUser } from "../../../../../lib/moviesData";

export async function GET() {
  const auth = await requireClientApi();
  if (!auth.ok) return auth.response;

  const data = await getMovieCatalogBootstrapForUser(auth.current.user.id, { page: 1, pageSize: 24 });
  return NextResponse.json({
    movies: data.page.movies,
    page: data.page.page,
    pageSize: data.page.pageSize,
    total: data.page.total,
    totalPages: data.page.totalPages,
    categories: data.categories,
    continueWatching: data.continueWatching,
  });
}
