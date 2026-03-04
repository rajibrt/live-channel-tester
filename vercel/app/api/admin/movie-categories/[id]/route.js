import { NextResponse } from "next/server";
import { requireAdminApi } from "../../../../../lib/adminApi";
import { getSupabaseAdmin } from "../../../../../lib/supabaseAdmin";

function toId(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : 0;
}

function normalizeSlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function PATCH(request, context) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const params = await context.params;
  const id = toId(params?.id);
  if (!id) return NextResponse.json({ error: "Invalid category id" }, { status: 400 });

  const payload = await request.json().catch(() => ({}));
  const name = String(payload?.name || "").trim();
  const slug = normalizeSlug(payload?.slug || name);
  const position = Math.max(0, Number(payload?.position || 0));
  if (!name || !slug) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("movie_categories")
    .update({ name, slug, position, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id,slug,name,position,updated_at")
    .single();

  if (error) return NextResponse.json({ error: error.message || "Failed to update category" }, { status: 500 });
  return NextResponse.json({ ok: true, item: data });
}

export async function DELETE(_request, context) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const params = await context.params;
  const id = toId(params?.id);
  if (!id) return NextResponse.json({ error: "Invalid category id" }, { status: 400 });

  const admin = getSupabaseAdmin();
  const { error } = await admin.from("movie_categories").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message || "Failed to delete category" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
