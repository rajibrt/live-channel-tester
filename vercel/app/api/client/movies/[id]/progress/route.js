import { NextResponse } from "next/server";
import { requireClientApi } from "../../../../../../lib/clientApi";
import { normalizeMovieId, normalizeProgressInput, normalizeSeconds } from "../../../../../../lib/movieProgress";
import { getSupabaseAdmin } from "../../../../../../lib/supabaseAdmin";

function normalizeSource(value) {
  const v = String(value || "progress").trim().toLowerCase();
  if (!v) return "progress";
  return v.slice(0, 32);
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
    .select("id,runtime_seconds,is_published")
    .eq("id", movieId)
    .eq("is_published", true)
    .maybeSingle();

  if (!movieRow) {
    return NextResponse.json({ error: "Movie not found" }, { status: 404 });
  }

  const payload = await request.json().catch(() => ({}));
  const base = normalizeProgressInput(payload);
  const fallbackDuration = normalizeSeconds(movieRow?.runtime_seconds);
  const durationSeconds = Math.max(base.durationSeconds, fallbackDuration);
  const positionSeconds = durationSeconds > 0 ? Math.min(base.positionSeconds, durationSeconds) : base.positionSeconds;
  const progressPercent =
    durationSeconds > 0 ? Math.round((positionSeconds / durationSeconds) * 10000) / 100 : base.progressPercent;
  const isCompleted = progressPercent >= 95;
  const now = new Date().toISOString();
  const userId = auth.current.user.id;

  const { error: progressErr } = await admin.from("movie_watch_progress").upsert(
    {
      user_id: userId,
      movie_id: movieId,
      position_seconds: positionSeconds,
      duration_seconds: durationSeconds,
      progress_percent: progressPercent,
      is_completed: isCompleted,
      last_event: "progress",
      updated_at: now,
    },
    { onConflict: "user_id,movie_id" }
  );

  if (progressErr) {
    return NextResponse.json({ error: progressErr.message || "Failed to save progress" }, { status: 500 });
  }

  await admin.from("movie_recent_history").upsert(
    {
      user_id: userId,
      movie_id: movieId,
      watched_at: now,
      position_seconds: positionSeconds,
      source: normalizeSource(payload?.source),
      updated_at: now,
    },
    { onConflict: "user_id,movie_id" }
  );

  await admin.from("client_activity_events").insert({
    user_id: userId,
    event_type: "movie_progress",
    event_data: {
      movie_id: String(movieId),
      position_seconds: positionSeconds,
      duration_seconds: durationSeconds,
      progress_percent: progressPercent,
      is_completed: isCompleted,
      source: normalizeSource(payload?.source),
    },
  });

  return NextResponse.json({
    ok: true,
    movie_id: String(movieId),
    position_seconds: positionSeconds,
    duration_seconds: durationSeconds,
    progress_percent: progressPercent,
    is_completed: isCompleted,
  });
}
