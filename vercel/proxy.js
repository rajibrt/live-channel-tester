import { NextResponse } from "next/server";

export function proxy(req) {
  if (req.method === "POST" && req.headers.has("next-action")) {
    return NextResponse.json(
      {
        error: "Stale Server Action reference. Reload the page and try again.",
      },
      {
        status: 409,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
