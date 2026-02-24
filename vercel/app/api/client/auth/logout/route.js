import { NextResponse } from "next/server";
import { CLIENT_SESSION_COOKIE, getCurrentClient } from "../../../../../lib/clientAuth";
import { getSupabaseAdmin } from "../../../../../lib/supabaseAdmin";

export async function POST(request) {
  const current = await getCurrentClient();
  if (current?.user?.id) {
    const admin = getSupabaseAdmin();
    await admin.from("client_activity_events").insert({
      user_id: current.user.id,
      event_type: "client_logout",
      event_data: { via: "manual" },
    });
  }

  const res = NextResponse.redirect(new URL("/client-login", request.url), { status: 302 });
  res.cookies.set(CLIENT_SESSION_COOKIE, "", {
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
  });
  return res;
}
