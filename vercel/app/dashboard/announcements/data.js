import { getSupabaseAdmin } from "../../../lib/supabaseAdmin";

const TABLE = "admin_announcements";

function mapItem(row) {
  const ct = String(row?.content_type || "").trim().toLowerCase();
  // Trust content_type from DB completely.
  // Only for legacy installs where the column doesn't exist yet (ct is empty),
  // fall back to flags so the admin dashboard can still display items correctly.
  if (ct === "announcement" || ct === "article") return { ...row, content_type: ct };
  return { ...row, content_type: (row?.show_title_in_ticker || row?.is_pinned) ? "announcement" : "article" };
}

function formatDbError(error, fallback) {
  const message = String(error?.message || fallback || "Request failed.");
  const code = String(error?.code || "");
  const lower = message.toLowerCase();
  if (code === "PGRST205" || code === "42P01" || lower.includes("schema cache") || lower.includes("does not exist")) {
    return "Announcements database table is not initialized yet. Your own object bucket only stores uploaded files; it does not create the article database table. Run `vercel/supabase/announcements.sql` in Supabase SQL Editor.";
  }
  return message;
}

export async function getAnnouncementItems() {
  const supabase = getSupabaseAdmin();
  const buildQuery = (selectClause) =>
    supabase
      .from(TABLE)
      .select(selectClause)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });

  const { data, error } = await buildQuery(
      "id,title,content_html,content_type,featured_image_url,featured_image_path,featured_image_bucket,position,is_published,is_pinned,show_title_in_ticker,created_at,updated_at,published_at"
    );

  if (error) {
    const lower = String(error?.message || "").toLowerCase();
    const missingContentType = String(error?.code || "") === "42703" || lower.includes("content_type");
    if (!missingContentType) {
      return { items: [], error: formatDbError(error, "Failed to load announcements.") };
    }

    const fallback = await buildQuery(
      "id,title,content_html,featured_image_url,featured_image_path,featured_image_bucket,position,is_published,is_pinned,show_title_in_ticker,created_at,updated_at,published_at"
    );
    if (fallback.error) {
      return { items: [], error: formatDbError(fallback.error, "Failed to load announcements.") };
    }
    return { items: Array.isArray(fallback.data) ? fallback.data.map(mapItem) : [], error: "" };
  }

  return { items: Array.isArray(data) ? data.map(mapItem) : [], error: "" };
}

export async function getAnnouncementItemById(id) {
  const safeId = String(id || "").trim();
  if (!safeId) return { item: null, error: "Invalid id." };

  const { items, error } = await getAnnouncementItems();
  if (error) return { item: null, error };

  const item = items.find((row) => String(row?.id || "") === safeId) || null;
  if (!item) return { item: null, error: "Item not found." };
  return { item, error: "" };
}
