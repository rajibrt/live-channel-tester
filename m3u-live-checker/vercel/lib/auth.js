import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin, getSupabaseAnonConfig } from "./supabaseAdmin";

export const ADMIN_SESSION_COOKIE = "m3u_admin_token";

export async function getCurrentAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value || "";
  if (!token) {
    return null;
  }

  const { url, anon } = getSupabaseAnonConfig();
  const authClient = createClient(url, anon, { auth: { persistSession: false } });
  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data?.user) {
    return null;
  }

  const admin = getSupabaseAdmin();
  const { data: row } = await admin
    .from("admin_users")
    .select("user_id,email,is_active")
    .eq("user_id", data.user.id)
    .eq("is_active", true)
    .single();
  if (!row) {
    return null;
  }
  return { user: data.user, admin: row, token };
}

export async function requireAdmin() {
  const current = await getCurrentAdmin();
  if (!current) {
    redirect("/login");
  }
  return current;
}
