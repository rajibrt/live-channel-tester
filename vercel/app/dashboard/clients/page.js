import ManageClientUsers from "./ManageClientUsers";
import styles from "../page.module.css";
import { getSupabaseAdmin } from "../../../lib/supabaseAdmin";

async function getClientUsers() {
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("client_users")
    .select("user_id,email,full_name,mobile_number,is_active,created_at,updated_at")
    .order("created_at", { ascending: false });
  return Array.isArray(data) ? data : [];
}

export default async function ClientsPage() {
  const items = await getClientUsers();

  return (
    <section className={styles.card}>
      <ManageClientUsers initialItems={items} />
    </section>
  );
}
