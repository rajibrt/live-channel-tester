import { NextResponse } from "next/server";
import { requireAdminApi } from "../../../../../lib/adminApi";
import { getSupabaseAdmin } from "../../../../../lib/supabaseAdmin";

export async function POST(request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const markAll = body?.mark_all === true;
  const notificationId = String(body?.notification_id || "").trim();
  const adminUserId = auth.current.user.id;
  const now = new Date().toISOString();
  const admin = getSupabaseAdmin();

  if (markAll) {
    const { error } = await admin
      .from("admin_notifications")
      .update({ is_read: true, read_at: now })
      .or(`target_admin_id.is.null,target_admin_id.eq.${adminUserId}`)
      .eq("is_read", false);
    if (error) {
      return NextResponse.json({ error: error.message || "Failed to mark notifications as read." }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (!notificationId) {
    return NextResponse.json({ error: "notification_id is required." }, { status: 400 });
  }

  const { error } = await admin
    .from("admin_notifications")
    .update({ is_read: true, read_at: now })
    .eq("id", notificationId)
    .or(`target_admin_id.is.null,target_admin_id.eq.${adminUserId}`);

  if (error) {
    return NextResponse.json({ error: error.message || "Failed to mark notification as read." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
