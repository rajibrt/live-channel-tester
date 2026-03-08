import { NextResponse } from "next/server";
import { requireAdminApi } from "../../../../lib/adminApi";
import { loadSiteSeoSettings, saveSiteSeoSettings } from "../../../../lib/siteSeoSettings";

export async function GET() {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  try {
    const settings = await loadSiteSeoSettings();
    return NextResponse.json(settings);
  } catch (err) {
    return NextResponse.json({ error: err?.message || "Failed to load site SEO settings." }, { status: 500 });
  }
}

export async function PATCH(request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  try {
    const settings = await saveSiteSeoSettings({
      adminUserId: auth.current.user.id,
      patch: body,
    });
    return NextResponse.json({ ok: true, settings });
  } catch (err) {
    return NextResponse.json({ error: err?.message || "Failed to save site SEO settings." }, { status: 500 });
  }
}
