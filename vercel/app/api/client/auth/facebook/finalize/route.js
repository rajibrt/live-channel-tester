import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { CLIENT_SESSION_COOKIE } from "../../../../../../lib/clientAuth";
import { upsertFacebookClientLogin } from "../../../../../../lib/facebookClientAuth";
import { getSupabaseAnonConfig } from "../../../../../../lib/supabaseAdmin";
import { createSessionToken, SESSION_MAX_AGE } from "../../../../../../lib/sessionToken";

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const accessToken = String(body?.access_token || "").trim();
    if (!accessToken) {
      return NextResponse.json({ error: "access_token is required." }, { status: 400 });
    }

    const { url, anon } = getSupabaseAnonConfig();
    const auth = createClient(url, anon, { auth: { persistSession: false } });
    const { data: userRes, error: userErr } = await auth.auth.getUser(accessToken);
    if (userErr || !userRes?.user?.id) {
      return NextResponse.json({ error: "Invalid OAuth token." }, { status: 401 });
    }

    const loginResult = await upsertFacebookClientLogin({
      user: userRes.user,
      via: "facebook_oauth_hash",
    });
    if (!loginResult.ok) {
      return NextResponse.json({ error: loginResult.errorMessage || "Failed to save profile." }, { status: 500 });
    }

    if (!loginResult.isActive) {
      return NextResponse.json({ ok: true, redirect_to: "/client-login?error=inactive" });
    }

    const redirectTo = loginResult.approvalStatus === "approved" ? "/" : "/?pending=1";
    const res = NextResponse.json({ ok: true, redirect_to: redirectTo });
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
    return NextResponse.json({ error: "Failed to finalize Facebook login." }, { status: 500 });
  }
}
