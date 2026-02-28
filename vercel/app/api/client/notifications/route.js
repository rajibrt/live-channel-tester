import { NextResponse } from "next/server";
import { requireClientApi } from "../../../../lib/clientApi";
import { getSupabaseAdmin } from "../../../../lib/supabaseAdmin";

const MAX_ITEMS = 25;

export async function GET() {
  const auth = await requireClientApi();
  if (!auth.ok) return auth.response;

  const userId = auth.current.user.id;
  const admin = getSupabaseAdmin();

  const { data: announcements, error } = await admin
    .from("admin_announcements")
    .select("id,title,content_html,is_pinned,published_at,updated_at,created_at")
    .eq("is_published", true)
    .order("updated_at", { ascending: false })
    .limit(MAX_ITEMS);

  if (error) {
    return NextResponse.json({ error: error.message || "Failed to load notifications." }, { status: 500 });
  }

  const ids = (announcements || []).map((row) => String(row.id || "")).filter(Boolean);
  let readSet = new Set();

  if (ids.length) {
    const { data: reads } = await admin
      .from("client_notification_reads")
      .select("announcement_id")
      .eq("user_id", userId)
      .in("announcement_id", ids);

    readSet = new Set((reads || []).map((row) => String(row.announcement_id || "")).filter(Boolean));
  }

  const items = (announcements || []).map((row) => {
    const id = String(row.id || "");
    return {
      id,
      title: String(row.title || "Announcement"),
      content_html: String(row.content_html || ""),
      is_pinned: !!row.is_pinned,
      published_at: row.published_at || null,
      updated_at: row.updated_at || row.created_at || null,
      is_read: readSet.has(id),
    };
  });

  const unread_count = items.reduce((acc, item) => acc + (item.is_read ? 0 : 1), 0);

  return NextResponse.json({ items, unread_count });
}
