import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../../lib/supabaseAdmin";
import { requireAdminApi } from "../../../../lib/adminApi";

export async function GET() {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("playlists")
    .select("slug,name,channel_count,updated_at")
    .order("updated_at", { ascending: false })
    .limit(300);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ items: data || [] });
}

export async function POST(request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const form = await request.formData();
  const slug = String(form.get("slug") || "").trim().toLowerCase();
  const name = String(form.get("name") || "").trim();
  if (!slug || !name) {
    return NextResponse.redirect(new URL("/dashboard/playlists", request.url), { status: 302 });
  }

  const supabase = getSupabaseAdmin();
  await supabase.from("playlists").upsert(
    [{ slug, name, updated_at: new Date().toISOString() }],
    { onConflict: "slug" }
  );
  return NextResponse.redirect(new URL("/dashboard/playlists", request.url), { status: 302 });
}
