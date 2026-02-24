import { NextResponse } from "next/server";
import { requireAdminApi } from "../../../../../../lib/adminApi";
import { getSupabaseAdmin } from "../../../../../../lib/supabaseAdmin";

export async function GET(_request, { params }) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const p = await params;
  const userId = String(p?.userId || "").trim();
  if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("client_recent_history")
    .select("id,channel_id,channel_name,watched_at,watch_seconds,source")
    .eq("user_id", userId)
    .neq("source", "sync")
    .order("watched_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message || "Failed to load watch history" }, { status: 500 });
  }

  return NextResponse.json({ items: data || [] });
}
