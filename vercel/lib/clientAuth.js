import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "./supabaseAdmin";
import { verifySessionToken } from "./sessionToken";

export const CLIENT_SESSION_COOKIE = "m3u_client_token";

export async function getCurrentClient() {
  const cookieStore = await cookies();
  const token = cookieStore.get(CLIENT_SESSION_COOKIE)?.value || "";
  if (!token) return null;
  const payload = verifySessionToken(token);
  if (!payload || payload.typ !== "client" || !payload.sub) return null;

  const admin = getSupabaseAdmin();
  const { data: row } = await admin
    .from("client_users")
    .select("user_id,email,full_name,mobile_number,is_active")
    .eq("user_id", payload.sub)
    .eq("is_active", true)
    .single();

  if (!row) return null;
  return { user: { id: row.user_id, email: row.email }, client: row, token };
}

export async function requireClient() {
  const current = await getCurrentClient();
  if (!current) redirect("/client-login");
  return current;
}
