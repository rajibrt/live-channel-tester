import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE } from "../../../../lib/auth";

export async function POST() {
  const res = new NextResponse(null, {
    status: 302,
    headers: { Location: "/login" },
  });
  res.cookies.set(ADMIN_SESSION_COOKIE, "", {
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 0,
  });
  return res;
}
