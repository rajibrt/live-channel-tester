import { NextResponse } from "next/server";
import { requireAdminApi } from "../../../../lib/adminApi";
import { loadClientAccessSettings, saveClientAccessSettings } from "../../../../lib/clientAccessSettings";

export async function GET() {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  try {
    const settings = await loadClientAccessSettings();
    return NextResponse.json(settings);
  } catch (err) {
    return NextResponse.json({ error: err?.message || "Failed to load client access settings." }, { status: 500 });
  }
}

export async function PATCH(request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  try {
    const settings = await saveClientAccessSettings({
      adminUserId: auth.current.user.id,
      patch: body,
    });
    return NextResponse.json({ ok: true, settings });
  } catch (err) {
    return NextResponse.json({ error: err?.message || "Failed to save client access settings." }, { status: 500 });
  }
}
