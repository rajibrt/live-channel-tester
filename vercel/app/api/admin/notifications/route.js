import { NextResponse } from "next/server";
import { requireAdminApi } from "../../../../lib/adminApi";
import { getSupabaseAdmin } from "../../../../lib/supabaseAdmin";

const MAX_ITEMS = 40;

export async function GET() {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const admin = getSupabaseAdmin();
  const adminUserId = auth.current.user.id;
  const { data, error } = await admin
    .from("admin_notifications")
    .select("id,type,title,message,payload_json,target_admin_id,is_read,read_at,created_at")
    .or(`target_admin_id.is.null,target_admin_id.eq.${adminUserId}`)
    .order("created_at", { ascending: false })
    .limit(MAX_ITEMS);

  if (error) {
    return NextResponse.json({ error: error.message || "Failed to load admin notifications." }, { status: 500 });
  }

  const items = Array.isArray(data) ? data : [];
  const unread_count = items.reduce((sum, item) => sum + (item?.is_read ? 0 : 1), 0);
  return NextResponse.json({ items, unread_count });
}
