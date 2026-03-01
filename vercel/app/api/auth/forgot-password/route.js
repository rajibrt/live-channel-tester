import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAnonConfig } from "../../../../lib/supabaseAdmin";

export async function POST(request) {
  const form = await request.formData();
  const email = String(form.get("email") || "").trim().toLowerCase();
  const loginUrl = new URL("/login?reset=sent", request.url);
  if (!email) {
    return NextResponse.redirect(new URL("/login?reset=invalid", request.url), { status: 302 });
  }

  try {
    const { url, anon } = getSupabaseAnonConfig();
    const auth = createClient(url, anon, { auth: { persistSession: false } });
    const origin = new URL(request.url).origin;
    await auth.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/admin-reset-password`,
    });
  } catch {
    // Keep response uniform so the endpoint does not reveal whether the email exists.
  }

  return NextResponse.redirect(loginUrl, { status: 302 });
}
