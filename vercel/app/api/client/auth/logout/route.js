import { NextResponse } from "next/server";
import { CLIENT_SESSION_COOKIE, getCurrentClient } from "../../../../../lib/clientAuth";
import { getSessionCookieDomain } from "../../../../../lib/cookieDomain";
import { getSupabaseAdmin } from "../../../../../lib/supabaseAdmin";

function redirectRelative(path) {
  return new NextResponse(null, {
    status: 302,
    headers: { Location: path },
  });
}

export async function POST() {
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

  const res = redirectRelative("/client-login");
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
