import { NextResponse } from "next/server";
import { requireClientApi } from "../../../../../../lib/clientApi";
import { normalizeMovieId, normalizeSeconds } from "../../../../../../lib/movieProgress";
import { getSupabaseAdmin } from "../../../../../../lib/supabaseAdmin";

export async function POST(_request, context) {
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
    .select("id,runtime_seconds,is_published")
    .eq("id", movieId)
    .eq("is_published", true)
    .maybeSingle();

  if (!movieRow) {
    return NextResponse.json({ error: "Movie not found" }, { status: 404 });
  }

  const now = new Date().toISOString();
  const userId = auth.current.user.id;
  const durationSeconds = Math.max(normalizeSeconds(movieRow?.runtime_seconds), 1);

  const { error: progressErr } = await admin.from("movie_watch_progress").upsert(
    {
      user_id: userId,
      movie_id: movieId,
      position_seconds: durationSeconds,
      duration_seconds: durationSeconds,
      progress_percent: 100,
      is_completed: true,
      last_event: "complete",
      updated_at: now,
    },
    { onConflict: "user_id,movie_id" }
  );

  if (progressErr) {
    return NextResponse.json({ error: progressErr.message || "Failed to complete movie" }, { status: 500 });
  }

  await admin.from("movie_recent_history").upsert(
    {
      user_id: userId,
      movie_id: movieId,
      watched_at: now,
      position_seconds: durationSeconds,
      source: "complete",
      updated_at: now,
    },
    { onConflict: "user_id,movie_id" }
  );

  await admin.from("client_activity_events").insert({
    user_id: userId,
    event_type: "movie_complete",
    event_data: {
      movie_id: String(movieId),
      position_seconds: durationSeconds,
      duration_seconds: durationSeconds,
      progress_percent: 100,
      is_completed: true,
    },
  });

  return NextResponse.json({ ok: true, movie_id: String(movieId), progress_percent: 100, is_completed: true });
}
