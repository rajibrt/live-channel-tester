import { NextResponse } from "next/server";
import { requireAdminApi } from "../../../../lib/adminApi";
import { getSupabaseAdmin } from "../../../../lib/supabaseAdmin";

function normalizeSub(body) {
  const sub = body?.subscription && typeof body.subscription === "object" ? body.subscription : {};
  const keys = sub?.keys && typeof sub.keys === "object" ? sub.keys : {};
  return {
    endpoint: String(sub?.endpoint || "").trim(),
    p256dh: String(keys?.p256dh || "").trim(),
    auth: String(keys?.auth || "").trim(),
    userAgent: String(body?.user_agent || "").trim(),
  };
}

export async function POST(request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const parsed = normalizeSub(body);
  if (!parsed.endpoint || !parsed.p256dh || !parsed.auth) {
    return NextResponse.json({ error: "Invalid push subscription payload." }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const now = new Date().toISOString();
  const { error } = await admin
    .from("admin_push_subscriptions")
    .upsert(
      {
        admin_user_id: auth.current.user.id,
        endpoint: parsed.endpoint,
        p256dh: parsed.p256dh,
        auth: parsed.auth,
        user_agent: parsed.userAgent,
        is_active: true,
        updated_at: now,
      },
      { onConflict: "endpoint" }
    );

  if (error) {
    return NextResponse.json({ error: error.message || "Failed to save push subscription." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const endpoint = String(body?.endpoint || "").trim();
  if (!endpoint) {
    return NextResponse.json({ error: "endpoint is required." }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from("admin_push_subscriptions")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("endpoint", endpoint)
    .eq("admin_user_id", auth.current.user.id);
  if (error) {
    return NextResponse.json({ error: error.message || "Failed to remove push subscription." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
