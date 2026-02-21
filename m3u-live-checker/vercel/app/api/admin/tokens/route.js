import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getSupabaseAdmin } from "../../../../lib/supabaseAdmin";
import { requireAdminApi } from "../../../../lib/adminApi";

function makeToken() {
  return randomBytes(24).toString("hex");
}

export async function POST(request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const form = await request.formData();
  const playlistSlug = String(form.get("playlist_slug") || "").trim().toLowerCase();
  if (!playlistSlug) {
    return NextResponse.redirect(new URL("/dashboard", request.url), { status: 302 });
  }

  const supabase = getSupabaseAdmin();
  await supabase
    .from("playlist_tokens")
    .upsert([{ playlist_slug: playlistSlug, token: makeToken(), is_active: true }], { onConflict: "playlist_slug" });
  return NextResponse.redirect(new URL("/dashboard", request.url), { status: 302 });
}
