import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAnonConfig } from "../../../../lib/supabaseAdmin";
import { getBaseUrl } from "../../../../lib/siteUrl";

export async function POST(request) {
  const baseUrl = getBaseUrl();
  const toRedirectUrl = (path) => new URL(path, `${baseUrl}/`);
  const form = await request.formData();
  const email = String(form.get("email") || "").trim().toLowerCase();
  const loginUrl = toRedirectUrl("/login?reset=sent");
  if (!email) {
    return NextResponse.redirect(toRedirectUrl("/login?reset=invalid"), { status: 302 });
  }

  try {
    const { url, anon } = getSupabaseAnonConfig();
    const auth = createClient(url, anon, { auth: { persistSession: false } });
    await auth.auth.resetPasswordForEmail(email, {
      redirectTo: toRedirectUrl("/admin-reset-password").toString(),
    });
  } catch {
    // Keep response uniform so the endpoint does not reveal whether the email exists.
  }

  return NextResponse.redirect(loginUrl, { status: 302 });
}
