import styles from "../page.module.css";
import { getSupabaseAdmin } from "../../../lib/supabaseAdmin";
import ManageAnnouncements from "./ManageAnnouncements";

const TABLE = "admin_announcements";

function formatDbError(error, fallback) {
  const message = String(error?.message || fallback || "Request failed.");
  const code = String(error?.code || "");
  const lower = message.toLowerCase();
  if (code === "PGRST205" || code === "42P01" || lower.includes("schema cache") || lower.includes("does not exist")) {
    return "Announcements module not initialized yet. Run `vercel/supabase/schema.sql` (or `vercel/supabase/announcements.sql`) in Supabase SQL Editor.";
  }
  return message;
}

async function getAnnouncements() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from(TABLE)
    .select("id,title,content_html,position,is_published,is_pinned,show_title_in_ticker,created_at,updated_at,published_at")
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    return { items: [], error: formatDbError(error, "Failed to load announcements.") };
  }
  return { items: Array.isArray(data) ? data : [], error: "" };
}

export default async function AnnouncementsPage() {
  const { items, error } = await getAnnouncements();
  return (
    <section className={styles.card}>
      <ManageAnnouncements initialItems={items} loadError={error} />
    </section>
  );
}
