import { NextResponse } from "next/server";
import { getCurrentAdmin } from "./auth";

export async function requireAdminApi() {
  const current = await getCurrentAdmin();
  if (!current) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { ok: true, current };
}
