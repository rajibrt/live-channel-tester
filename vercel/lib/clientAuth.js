import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin, getSupabaseAnonConfig } from "./supabaseAdmin";

export const CLIENT_SESSION_COOKIE = "m3u_client_token";

export async function getCurrentClient() {
  const cookieStore = await cookies();
  const token = cookieStore.get(CLIENT_SESSION_COOKIE)?.value || "";
  if (!token) return null;

  const { url, anon } = getSupabaseAnonConfig();
  const authClient = createClient(url, anon, { auth: { persistSession: false } });
  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data?.user) return null;

  const admin = getSupabaseAdmin();
  const { data: row } = await admin
    .from("client_users")
    .select("user_id,email,full_name,is_active")
    .eq("user_id", data.user.id)
    .eq("is_active", true)
    .single();

  if (!row) return null;
  return { user: data.user, client: row, token };
}

export async function requireClient() {
  const current = await getCurrentClient();
  if (!current) redirect("/client-login");
  return current;
}
