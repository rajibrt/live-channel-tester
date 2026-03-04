import { NextResponse } from "next/server";
import { requireAdminApi } from "../../../../../lib/adminApi";
import { fetchImdbMovieById } from "../../../../../lib/imdbData";

export async function POST(request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const payload = await request.json().catch(() => ({}));
  const query = String(payload?.query || payload?.imdb_id || "").trim();
  if (!query) {
    return NextResponse.json({ error: "IMDb ID is required" }, { status: 400 });
  }

  try {
    const movie = await fetchImdbMovieById(query);
    return NextResponse.json({ item: movie });
  } catch (error) {
    return NextResponse.json({ error: error?.message || "Failed to fetch IMDb data" }, { status: 422 });
  }
}
