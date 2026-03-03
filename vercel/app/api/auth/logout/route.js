import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE } from "../../../../lib/auth";
import { getBaseUrl } from "../../../../lib/siteUrl";

export async function POST() {
  const baseUrl = getBaseUrl();
  const res = NextResponse.redirect(new URL("/login", `${baseUrl}/`), { status: 302 });
  res.cookies.set(ADMIN_SESSION_COOKIE, "", {
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 0,
  });
  return res;
}
