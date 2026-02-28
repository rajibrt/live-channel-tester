import ManageClientUsers from "./ManageClientUsers";
import styles from "../page.module.css";
import { getSupabaseAdmin } from "../../../lib/supabaseAdmin";
import { getActiveViewerSnapshot } from "../../../lib/activeViewers";
import ActiveViewersPanel from "../ActiveViewersPanel";

async function getClientUsers() {
  const admin = getSupabaseAdmin();
  const [{ data: users }, { data: historyRows }] = await Promise.all([
    admin
    .from("client_users")
    .select("user_id,email,full_name,mobile_number,is_active,approval_status,approval_note,auth_provider,provider_user_id,avatar_url,created_at,updated_at")
    .order("created_at", { ascending: false }),
    admin
      .from("client_recent_history")
      .select("user_id,watch_seconds,watched_at,source")
      .neq("source", "sync"),
  ]);

  const aggregates = new Map();
  for (const row of Array.isArray(historyRows) ? historyRows : []) {
    const userId = String(row?.user_id || "").trim();
    if (!userId) continue;
    const watchSeconds = Math.max(0, Math.floor(Number(row?.watch_seconds || 0)));
    const watchedAt = String(row?.watched_at || "").trim();
    const prev = aggregates.get(userId) || {
      watch_count: 0,
      total_watch_seconds: 0,
      last_watched_at: "",
    };
    const nextLast =
      watchedAt && (!prev.last_watched_at || new Date(watchedAt).getTime() > new Date(prev.last_watched_at).getTime())
        ? watchedAt
        : prev.last_watched_at;
    aggregates.set(userId, {
      watch_count: prev.watch_count + 1,
      total_watch_seconds: prev.total_watch_seconds + watchSeconds,
      last_watched_at: nextLast,
    });
  }

  return (Array.isArray(users) ? users : []).map((user) => {
    const meta = aggregates.get(String(user.user_id || "").trim()) || {
      watch_count: 0,
      total_watch_seconds: 0,
      last_watched_at: "",
    };
    return {
      ...user,
      watch_count: meta.watch_count,
      total_watch_seconds: meta.total_watch_seconds,
      last_watched_at: meta.last_watched_at,
    };
  });
}

export default async function ClientsPage() {
  const [items, activeViewers] = await Promise.all([getClientUsers(), getActiveViewerSnapshot()]);

  return (
    <>
      <section className={styles.stats}>
        <ActiveViewersPanel title="Watching Now" viewers={activeViewers?.viewers || []} />
      </section>
      <section className={styles.card}>
        <ManageClientUsers initialItems={items} />
      </section>
    </>
  );
}
