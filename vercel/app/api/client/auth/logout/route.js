import { NextResponse } from "next/server";
import { CLIENT_SESSION_COOKIE, getCurrentClient } from "../../../../../lib/clientAuth";
import { getSessionCookieDomain } from "../../../../../lib/cookieDomain";
import { getBaseUrl } from "../../../../../lib/siteUrl";
import { getSupabaseAdmin } from "../../../../../lib/supabaseAdmin";

export async function POST(request) {
  const baseUrl = getBaseUrl();
  const cookieDomain = getSessionCookieDomain();

  const current = await getCurrentClient();
  if (current?.user?.id) {
    const admin = getSupabaseAdmin();
    await admin.from("client_activity_events").insert({
      user_id: current.user.id,
      event_type: "client_logout",
      event_data: { via: "manual" },
    });
  }

  const res = NextResponse.redirect(new URL("/client-login", `${baseUrl}/`), { status: 302 });
  res.cookies.set(CLIENT_SESSION_COOKIE, "", {
    ...(cookieDomain ? { domain: cookieDomain } : {}),
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
  });
  return res;
}
