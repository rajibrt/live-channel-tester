import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getSupabaseAdmin } from "../../../../lib/supabaseAdmin";
import { requireAdminApi } from "../../../../lib/adminApi";
import { getBaseUrl } from "../../../../lib/siteUrl";

function makeToken() {
  return randomBytes(24).toString("hex");
}

export async function POST(request) {
  const baseUrl = getBaseUrl();
  const toRedirectUrl = (path) => new URL(path, `${baseUrl}/`);
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const form = await request.formData();
  const playlistSlug = String(form.get("playlist_slug") || "").trim().toLowerCase();
  if (!playlistSlug) {
    return NextResponse.redirect(toRedirectUrl("/dashboard"), { status: 302 });
  }

  const supabase = getSupabaseAdmin();
  await supabase
    .from("playlist_tokens")
    .upsert([{ playlist_slug: playlistSlug, token: makeToken(), is_active: true }], { onConflict: "playlist_slug" });
  return NextResponse.redirect(toRedirectUrl("/dashboard"), { status: 302 });
}
