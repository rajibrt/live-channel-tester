import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "./supabaseAdmin";
import { verifySessionToken } from "./sessionToken";

export const ADMIN_SESSION_COOKIE = "m3u_admin_token";

export async function getCurrentAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value || "";
  if (!token) return null;
  const payload = verifySessionToken(token);
  if (!payload || payload.typ !== "admin" || !payload.sub) return null;

  const admin = getSupabaseAdmin();
  const { data: row } = await admin
    .from("admin_users")
    .select("user_id,email,is_active")
    .eq("user_id", payload.sub)
    .eq("is_active", true)
    .single();
  if (!row) return null;
  return { user: { id: row.user_id, email: row.email }, admin: row, token };
}

export async function requireAdmin() {
  const current = await getCurrentAdmin();
  if (!current) {
    redirect("/login");
  }
  return current;
}
