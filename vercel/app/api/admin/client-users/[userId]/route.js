import { NextResponse } from "next/server";
import { requireAdminApi } from "../../../../../lib/adminApi";
import { getSupabaseAdmin } from "../../../../../lib/supabaseAdmin";

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeMobile(value) {
  const raw = String(value || "").trim();
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 11) return { raw, key: "" };
  return { raw, key: digits.slice(-11) };
}

export async function PATCH(request, { params }) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const p = await params;
  const userId = String(p?.userId || "").trim();
  if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const admin = getSupabaseAdmin();

  const patches = {};
  if (typeof body?.is_active === "boolean") patches.is_active = body.is_active;
  if (typeof body?.full_name === "string") patches.full_name = body.full_name.trim();
  let nextEmail = "";
  if (typeof body?.email === "string") {
    const prepared = normalizeEmail(body.email);
    if (prepared) nextEmail = prepared;
  }
  if (typeof body?.mobile_number === "string") {
    const mobile = normalizeMobile(body.mobile_number);
    if (!mobile.key) {
      return NextResponse.json({ error: "mobile_number must include at least 11 digits" }, { status: 400 });
    }
    patches.mobile_number = mobile.raw;
    patches.mobile_login_key = mobile.key;
  }
  if (!Object.keys(patches).length && !body?.new_password && !nextEmail) {
    return NextResponse.json({ error: "No changes provided" }, { status: 400 });
  }

  if (nextEmail) {
    const { error: authEmailErr } = await admin.auth.admin.updateUserById(userId, { email: nextEmail });
    if (authEmailErr) return NextResponse.json({ error: authEmailErr.message || "Failed to update email" }, { status: 400 });
    patches.email = nextEmail;
  }

  if (body?.new_password) {
    const pwd = String(body.new_password);
    if (pwd.length < 8) {
      return NextResponse.json({ error: "new_password must be at least 8 characters" }, { status: 400 });
    }
    const { error: pwErr } = await admin.auth.admin.updateUserById(userId, { password: pwd });
    if (pwErr) return NextResponse.json({ error: pwErr.message || "Failed to reset password" }, { status: 400 });
  }

  if (Object.keys(patches).length) {
    patches.updated_at = new Date().toISOString();
    const { error } = await admin.from("client_users").update(patches).eq("user_id", userId);
    if (error) return NextResponse.json({ error: error.message || "Failed to update user" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
