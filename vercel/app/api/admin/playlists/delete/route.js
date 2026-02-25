import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { requireAdminApi } from "../../../../../lib/adminApi";

function isMissingColumn(error) {
  const msg = String(error?.message || "").toLowerCase();
  return msg.includes("column") && msg.includes("does not exist");
}

function isNullViolation(error) {
  const msg = String(error?.message || "").toLowerCase();
  return msg.includes("null value") && msg.includes("violates not-null constraint");
}

function isForeignKeyError(error) {
  const msg = String(error?.message || "").toLowerCase();
  return msg.includes("foreign key") || msg.includes("violates foreign key constraint");
}

export async function POST(request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const slug = String(body?.slug || "").trim().toLowerCase();
  if (!slug) return NextResponse.json({ error: "slug is required." }, { status: 400 });

  const supabase = getSupabaseAdmin();

  const { data: exists, error: checkErr } = await supabase
    .from("playlists")
    .select("slug")
    .eq("slug", slug)
    .maybeSingle();
  if (checkErr) return NextResponse.json({ error: checkErr.message }, { status: 500 });
  if (!exists) return NextResponse.json({ error: "Playlist not found." }, { status: 404 });

  let deleteAttempt = await supabase.from("playlists").delete().eq("slug", slug);
  if (!deleteAttempt.error) return NextResponse.json({ ok: true, slug });

  if (!isForeignKeyError(deleteAttempt.error)) {
    return NextResponse.json({ error: deleteAttempt.error.message }, { status: 500 });
  }

  // Compatibility path for databases where channels has playlist_slug relation.
  const clearChannels = await supabase
    .from("channels")
    .update({ playlist_slug: null })
    .eq("playlist_slug", slug);

  if (clearChannels.error && !isMissingColumn(clearChannels.error)) {
    if (isNullViolation(clearChannels.error)) {
      const removeChannels = await supabase
        .from("channels")
        .delete()
        .eq("playlist_slug", slug);
      if (removeChannels.error && !isMissingColumn(removeChannels.error)) {
        return NextResponse.json({ error: removeChannels.error.message }, { status: 500 });
      }
    } else {
      return NextResponse.json({ error: clearChannels.error.message }, { status: 500 });
    }
  }

  deleteAttempt = await supabase.from("playlists").delete().eq("slug", slug);
  if (deleteAttempt.error) {
    return NextResponse.json({ error: deleteAttempt.error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, slug });
}
