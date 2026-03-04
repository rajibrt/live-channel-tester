import { NextResponse } from "next/server";
import { requireAdminApi } from "../../../../lib/adminApi";
import { getSupabaseAdmin } from "../../../../lib/supabaseAdmin";

function normalizeSlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function GET() {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("movie_categories")
    .select("id,slug,name,position,updated_at")
    .order("position", { ascending: true })
    .order("name", { ascending: true });

  if (error) return NextResponse.json({ error: error.message || "Failed to load categories" }, { status: 500 });
  return NextResponse.json({ items: data || [] });
}

export async function POST(request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const payload = await request.json().catch(() => ({}));
  const name = String(payload?.name || "").trim();
  const slug = normalizeSlug(payload?.slug || name);
  const position = Math.max(0, Number(payload?.position || 0));

  if (!name || !slug) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("movie_categories")
    .upsert(
      {
        slug,
        name,
        position,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "slug" }
    )
    .select("id,slug,name,position,updated_at")
    .single();

  if (error) return NextResponse.json({ error: error.message || "Failed to save category" }, { status: 500 });
  return NextResponse.json({ ok: true, item: data });
}
