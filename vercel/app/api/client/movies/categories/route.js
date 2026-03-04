import { NextResponse } from "next/server";
import { requireClientApi } from "../../../../../lib/clientApi";
import { getMoviesCatalogForUser } from "../../../../../lib/moviesData";

export async function GET() {
  const auth = await requireClientApi();
  if (!auth.ok) return auth.response;

  const data = await getMoviesCatalogForUser(auth.current.user.id);
  return NextResponse.json({
    categories: data.categories,
    total: data.categories.length,
  });
}
