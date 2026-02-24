import { NextResponse } from "next/server";
import { getCurrentClient } from "./clientAuth";

export async function requireClientApi() {
  const current = await getCurrentClient();
  if (!current) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { ok: true, current };
}
