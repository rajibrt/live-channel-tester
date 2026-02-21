import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { requireAdminApi } from "../../../../../lib/adminApi";

export async function POST(request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const streamUrl = String(body.stream_url || "").trim();
  const category = String(body.category || "").trim();
  if (!streamUrl) {
    return NextResponse.json({ error: "stream_url is required" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("channels")
    .update({ category, updated_at: new Date().toISOString() })
    .eq("stream_url", streamUrl);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
