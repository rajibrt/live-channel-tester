import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { CLIENT_SESSION_COOKIE } from "../../../../../../lib/clientAuth";
import { upsertFacebookClientLogin } from "../../../../../../lib/facebookClientAuth";
import { getSupabaseAnonConfig } from "../../../../../../lib/supabaseAdmin";
import { createSessionToken, SESSION_MAX_AGE } from "../../../../../../lib/sessionToken";

export async function GET(request) {
  const reqUrl = new URL(request.url);
  const code = String(reqUrl.searchParams.get("code") || "").trim();
  if (!code) {
    return NextResponse.redirect(new URL("/client-login", request.url), { status: 302 });
  }

  try {
    const { url, anon } = getSupabaseAnonConfig();
    const auth = createClient(url, anon, { auth: { persistSession: false } });
    const { data, error } = await auth.auth.exchangeCodeForSession(code);
    if (error || !data?.user?.id) {
      return NextResponse.redirect(new URL("/client-login?error=facebook_callback", request.url), { status: 302 });
    }

    const loginResult = await upsertFacebookClientLogin({
      user: data.user,
      via: "facebook_oauth",
    });
    if (!loginResult.ok) {
      return NextResponse.redirect(
        new URL(`/client-login?error=${encodeURIComponent(loginResult.errorCode || "facebook_profile")}`, request.url),
        { status: 302 }
      );
    }

    if (!loginResult.isActive) {
      return NextResponse.redirect(new URL("/client-login?error=inactive", request.url), { status: 302 });
    }

    const redirectUrl = new URL(loginResult.approvalStatus === "approved" ? "/" : "/?pending=1", request.url);
    const res = NextResponse.redirect(redirectUrl, { status: 302 });
    const sessionToken = createSessionToken({ sub: loginResult.userId, typ: "client" }, SESSION_MAX_AGE);
    res.cookies.set(CLIENT_SESSION_COOKIE, sessionToken, {
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_MAX_AGE,
    });
    return res;
  } catch {
    return NextResponse.redirect(new URL("/client-login?error=facebook_callback", request.url), { status: 302 });
  }
}
