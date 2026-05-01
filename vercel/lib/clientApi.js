import { NextResponse } from "next/server";
import { getCurrentClient } from "./clientAuth";
import { loadClientAccessSettingsCached } from "./clientAccessSettings";

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

export async function requireClientOrPublicReadApi() {
  const current = await getCurrentClient();
  if (current) return { ok: true, current, isPublicGuest: false };

  const settings = await loadClientAccessSettingsCached().catch(() => null);
  if (settings?.public_guest_access_enabled === true) {
    return { ok: true, current: null, isPublicGuest: true };
  }

  return {
    ok: false,
    response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
  };
}
