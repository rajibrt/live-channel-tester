import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE } from "../../../../lib/auth";

export async function POST(request) {
  const res = NextResponse.redirect(new URL("/login", request.url), { status: 302 });
  res.cookies.set(ADMIN_SESSION_COOKIE, "", {
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 0,
  });
  return res;
}
