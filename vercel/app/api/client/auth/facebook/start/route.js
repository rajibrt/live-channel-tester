import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAnonConfig } from "../../../../../../lib/supabaseAdmin";

export async function GET(request) {
  try {
    const { url, anon } = getSupabaseAnonConfig();
    const auth = createClient(url, anon, { auth: { persistSession: false } });
    const redirectTo = new URL("/api/client/auth/facebook/callback", request.url).toString();

    const { data, error } = await auth.auth.signInWithOAuth({
      provider: "facebook",
      options: {
        redirectTo,
        scopes: "email public_profile",
      },
    });

    if (error || !data?.url) {
      return NextResponse.redirect(new URL("/client-login?error=facebook_start", request.url), { status: 302 });
    }

    return NextResponse.redirect(data.url, { status: 302 });
  } catch {
    return NextResponse.redirect(new URL("/client-login?error=facebook_start", request.url), { status: 302 });
  }
}
