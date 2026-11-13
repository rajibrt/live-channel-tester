import { NextResponse } from "next/server";
import { requireClientOrPublicReadApi } from "../../../../../lib/clientApi";
import { getMovieRowsForUser } from "../../../../../lib/moviesData";

// Rows for the Movies home (Recently added, Bangla, Hindi, …, genres), each with a few movies.
export async function GET() {
  const auth = await requireClientOrPublicReadApi();
  if (!auth.ok) return auth.response;
  try {
    const rows = await getMovieRowsForUser(auth.current?.user?.id || "");
    return NextResponse.json({ rows });
  } catch (err) {
    console.error("movie rows failed", err);
    return NextResponse.json({ error: "Could not load movies" }, { status: 500 });
  }
}
