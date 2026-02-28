import { NextResponse } from "next/server";
import { requireClientApi } from "../../../../../lib/clientApi";
import { getSupabaseAdmin } from "../../../../../lib/supabaseAdmin";

async function loadPublishedAnnouncementIds(admin, limit) {
  const { data, error } = await admin
    .from("admin_announcements")
    .select("id")
    .eq("is_published", true)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message || "Failed to load notifications.");
  return (data || []).map((row) => String(row.id || "")).filter(Boolean);
}

export async function POST(request) {
  const auth = await requireClientApi();
  if (!auth.ok) return auth.response;

  const payload = await request.json().catch(() => ({}));
  const markAll = payload?.mark_all === true;
  const announcementId = String(payload?.announcement_id || "").trim();

  if (!markAll && !announcementId) {
    return NextResponse.json({ error: "announcement_id or mark_all is required" }, { status: 400 });
  }

  const userId = auth.current.user.id;
  const admin = getSupabaseAdmin();

  try {
    const ids = markAll ? await loadPublishedAnnouncementIds(admin, 100) : [announcementId];
    if (!ids.length) return NextResponse.json({ ok: true, marked: 0 });

    const rows = ids.map((id) => ({
      user_id: userId,
      announcement_id: id,
      read_at: new Date().toISOString(),
    }));

    const { error } = await admin
      .from("client_notification_reads")
      .upsert(rows, { onConflict: "user_id,announcement_id", ignoreDuplicates: false });

    if (error) {
      return NextResponse.json({ error: error.message || "Failed to mark notifications as read." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, marked: rows.length });
  } catch (err) {
    return NextResponse.json({ error: err?.message || "Failed to mark notifications as read." }, { status: 500 });
  }
}
