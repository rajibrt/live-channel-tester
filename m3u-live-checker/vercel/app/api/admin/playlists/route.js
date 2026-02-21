import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../../lib/supabaseAdmin";
import { requireAdminApi } from "../../../../lib/adminApi";

export async function POST(request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const form = await request.formData();
  const slug = String(form.get("slug") || "").trim().toLowerCase();
  const name = String(form.get("name") || "").trim();
  if (!slug || !name) {
    return NextResponse.redirect(new URL("/dashboard", request.url), { status: 302 });
  }

  const supabase = getSupabaseAdmin();
  await supabase.from("playlists").upsert(
    [{ slug, name, updated_at: new Date().toISOString() }],
    { onConflict: "slug" }
  );
  return NextResponse.redirect(new URL("/dashboard", request.url), { status: 302 });
}
