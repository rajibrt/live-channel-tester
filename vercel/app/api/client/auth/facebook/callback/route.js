import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { CLIENT_SESSION_COOKIE } from "../../../../../../lib/clientAuth";
import { getSessionCookieDomain } from "../../../../../../lib/cookieDomain";
import { upsertFacebookClientLogin } from "../../../../../../lib/facebookClientAuth";
import { buildClientMetaFromRequest } from "../../../../../../lib/requestClientMeta";
import { getBaseUrl } from "../../../../../../lib/siteUrl";
import { getSupabaseAnonConfig } from "../../../../../../lib/supabaseAdmin";
import { createSessionToken, SESSION_MAX_AGE } from "../../../../../../lib/sessionToken";

export async function GET(request) {
  const baseUrl = getBaseUrl();
  const cookieDomain = getSessionCookieDomain();
  const toRedirectUrl = (path) => new URL(path, `${baseUrl}/`);

  const reqUrl = new URL(request.url);
  const code = String(reqUrl.searchParams.get("code") || "").trim();
  if (!code) {
    return NextResponse.redirect(toRedirectUrl("/client-login"), { status: 302 });
  }

  try {
    const { url, anon } = getSupabaseAnonConfig();
    const auth = createClient(url, anon, { auth: { persistSession: false } });
    const { data, error } = await auth.auth.exchangeCodeForSession(code);
    if (error || !data?.user?.id) {
      return NextResponse.redirect(toRedirectUrl("/client-login?error=facebook_callback"), { status: 302 });
    }

    const requestMeta = buildClientMetaFromRequest(request);
    const loginResult = await upsertFacebookClientLogin({
      user: data.user,
      via: "facebook_oauth",
      requestMeta,
    });
    if (!loginResult.ok) {
      return NextResponse.redirect(
        toRedirectUrl(`/client-login?error=${encodeURIComponent(loginResult.errorCode || "facebook_profile")}`),
        { status: 302 }
      );
    }

    if (!loginResult.isActive) {
      return NextResponse.redirect(toRedirectUrl("/client-login?error=inactive"), { status: 302 });
    }

    const redirectUrl = toRedirectUrl(loginResult.approvalStatus === "approved" ? "/" : "/?pending=1");
    const res = NextResponse.redirect(redirectUrl, { status: 302 });
    const sessionToken = createSessionToken({ sub: loginResult.userId, typ: "client" }, SESSION_MAX_AGE);
    res.cookies.set(CLIENT_SESSION_COOKIE, sessionToken, {
      ...(cookieDomain ? { domain: cookieDomain } : {}),
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_MAX_AGE,
    });
    return res;
  } catch {
    return NextResponse.redirect(toRedirectUrl("/client-login?error=facebook_callback"), { status: 302 });
  }
}
