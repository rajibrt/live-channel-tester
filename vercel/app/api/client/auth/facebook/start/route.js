import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getBaseUrl } from "../../../../../../lib/siteUrl";
import { getSupabaseAnonConfig } from "../../../../../../lib/supabaseAdmin";

export async function GET(request) {
  const baseUrl = getBaseUrl();
  const toRedirectUrl = (path) => new URL(path, `${baseUrl}/`);

  try {
    const { url, anon } = getSupabaseAnonConfig();
    const auth = createClient(url, anon, { auth: { persistSession: false } });
    const redirectTo = toRedirectUrl("/api/client/auth/facebook/callback").toString();

    const { data, error } = await auth.auth.signInWithOAuth({
      provider: "facebook",
      options: {
        redirectTo,
        scopes: "email public_profile",
      },
    });

    if (error || !data?.url) {
      return NextResponse.redirect(toRedirectUrl("/client-login?error=facebook_start"), { status: 302 });
    }

    return NextResponse.redirect(data.url, { status: 302 });
  } catch {
    return NextResponse.redirect(toRedirectUrl("/client-login?error=facebook_start"), { status: 302 });
  }
}
