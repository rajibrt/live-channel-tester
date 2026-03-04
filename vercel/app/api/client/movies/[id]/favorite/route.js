import { NextResponse } from "next/server";
import { requireClientApi } from "../../../../../../lib/clientApi";
import { normalizeMovieId } from "../../../../../../lib/movieProgress";
import { getSupabaseAdmin } from "../../../../../../lib/supabaseAdmin";

function parseFavorite(value) {
  if (value === true || value === false) return value;
  return null;
}

export async function POST(request, context) {
  const auth = await requireClientApi();
  if (!auth.ok) return auth.response;

  const params = await context.params;
  const movieId = normalizeMovieId(params?.id);
  if (!movieId) {
    return NextResponse.json({ error: "Invalid movie id" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { data: movieRow } = await admin
    .from("movies")
    .select("id,is_published")
    .eq("id", movieId)
    .eq("is_published", true)
    .maybeSingle();

  if (!movieRow) {
    return NextResponse.json({ error: "Movie not found" }, { status: 404 });
  }

  const payload = await request.json().catch(() => ({}));
  const explicitFavorite = parseFavorite(payload?.favorite);
  const userId = auth.current.user.id;

  const { data: existing } = await admin
    .from("movie_favorites")
    .select("movie_id")
    .eq("user_id", userId)
    .eq("movie_id", movieId)
    .maybeSingle();

  const hasFavorite = Boolean(existing?.movie_id);
  const nextFavorite = explicitFavorite === null ? !hasFavorite : explicitFavorite;

  if (nextFavorite) {
    const { error } = await admin.from("movie_favorites").upsert(
      {
        user_id: userId,
        movie_id: movieId,
      },
      { onConflict: "user_id,movie_id" }
    );
    if (error) {
      return NextResponse.json({ error: error.message || "Failed to set favorite" }, { status: 500 });
    }
  } else {
    const { error } = await admin
      .from("movie_favorites")
      .delete()
      .eq("user_id", userId)
      .eq("movie_id", movieId);
    if (error) {
      return NextResponse.json({ error: error.message || "Failed to clear favorite" }, { status: 500 });
    }
  }

  await admin.from("client_activity_events").insert({
    user_id: userId,
    event_type: "movie_favorite_toggle",
    event_data: {
      movie_id: String(movieId),
      favorite: nextFavorite,
    },
  });

  return NextResponse.json({ ok: true, movie_id: String(movieId), favorite: nextFavorite });
}
