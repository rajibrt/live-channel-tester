import { NextResponse } from "next/server";
import { requireAdminApi } from "../../../../lib/adminApi";
import { loadEmailSettings, saveEmailSettings, toPublicEmailSettings } from "../../../../lib/emailDelivery";

export async function GET() {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  try {
    const settings = await loadEmailSettings();
    return NextResponse.json(toPublicEmailSettings(settings));
  } catch (err) {
    return NextResponse.json({ error: err?.message || "Failed to load email settings." }, { status: 500 });
  }
}

export async function PATCH(request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  try {
    const next = await saveEmailSettings({
      adminUserId: auth.current.user.id,
      patch: body,
    });
    return NextResponse.json({ ok: true, settings: toPublicEmailSettings(next) });
  } catch (err) {
    return NextResponse.json({ error: err?.message || "Failed to save email settings." }, { status: 500 });
  }
}
