import { NextResponse } from "next/server";
import { requireClientApi } from "../../../../lib/clientApi";
import { getMoviesPageForUser } from "../../../../lib/moviesData";

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
  const data = await getMoviesPageForUser(auth.current.user.id, { page, pageSize });

  return NextResponse.json({
    movies: data.movies,
    page: data.page,
    pageSize: data.pageSize,
    total: data.total,
    totalPages: data.totalPages,
  });
}
