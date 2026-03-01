import { NextResponse } from "next/server";
import { requireAdminApi } from "../../../../../lib/adminApi";
import { loadEmailSettings, sendClientWelcomeEmail } from "../../../../../lib/emailDelivery";
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
  const { data: existing, error: existingErr } = await admin
    .from("client_users")
    .select("user_id,email,full_name,mobile_number,is_active,approval_status,approved_at,auth_provider,created_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (existingErr) return NextResponse.json({ error: existingErr.message || "Failed to load user." }, { status: 500 });
  if (!existing?.user_id) return NextResponse.json({ error: "User not found." }, { status: 404 });

  const patches = {};
  const previousApproval = String(existing?.approval_status || "approved").trim().toLowerCase();
  if (typeof body?.is_active === "boolean") patches.is_active = body.is_active;
  if (typeof body?.full_name === "string") patches.full_name = body.full_name.trim();
  if (typeof body?.approval_status === "string") {
    const next = String(body.approval_status || "").trim().toLowerCase();
    if (!["pending", "approved", "rejected"].includes(next)) {
      return NextResponse.json({ error: "approval_status must be pending, approved, or rejected" }, { status: 400 });
    }
    patches.approval_status = next;
    if (next === "approved") {
      if (previousApproval !== "approved" || !existing?.approved_at) {
        patches.approved_at = new Date().toISOString();
        patches.approved_by_admin = auth.current.user.id;
      }
    } else {
      patches.approved_at = null;
      patches.approved_by_admin = null;
    }
  }
  if (typeof body?.approval_note === "string") {
    patches.approval_note = String(body.approval_note || "").trim();
  }
  let nextEmail = "";
  if (typeof body?.email === "string") {
    const prepared = normalizeEmail(body.email);
    if (prepared) nextEmail = prepared;
  }
  if (typeof body?.mobile_number === "string") {
    const rawMobile = String(body.mobile_number || "").trim();
    if (!rawMobile) {
      patches.mobile_number = "";
      patches.mobile_login_key = null;
    } else {
      const mobile = normalizeMobile(rawMobile);
      if (!mobile.key) {
        return NextResponse.json({ error: "mobile_number must include at least 11 digits" }, { status: 400 });
      }
      patches.mobile_number = mobile.raw;
      patches.mobile_login_key = mobile.key;
    }
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

  const nextApproval = String(patches?.approval_status || previousApproval || "approved").trim().toLowerCase();
  const becameApproved = previousApproval !== "approved" && nextApproval === "approved";
  let welcome_email = { sent: false, skipped: true, reason: "Not triggered." };

  if (becameApproved) {
    try {
      const settings = await loadEmailSettings(admin);
      const result = await sendClientWelcomeEmail({
        settings,
        forceSend: false,
        clientUser: {
          ...existing,
          ...patches,
          user_id: userId,
          approval_status: "approved",
        },
      });
      welcome_email = result;
    } catch (err) {
      welcome_email = {
        sent: false,
        skipped: false,
        error: err?.message || "Failed to send welcome email.",
      };
    }
  }

  return NextResponse.json({ ok: true, welcome_email });
}

export async function DELETE(_request, { params }) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const p = await params;
  const userId = String(p?.userId || "").trim();
  if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

  const admin = getSupabaseAdmin();
  const { data: existing, error: existingErr } = await admin
    .from("client_users")
    .select("user_id,is_active")
    .eq("user_id", userId)
    .maybeSingle();

  if (existingErr) {
    return NextResponse.json({ error: existingErr.message || "Failed to load user" }, { status: 500 });
  }
  if (!existing?.user_id) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }
  if (existing.is_active !== false) {
    return NextResponse.json({ error: "Only inactive profiles can be deleted." }, { status: 400 });
  }

  const { error: authDeleteErr } = await admin.auth.admin.deleteUser(userId, false);
  const authDeleteMsg = String(authDeleteErr?.message || "");
  const userMissingInAuth = authDeleteMsg.toLowerCase().includes("not found");
  if (authDeleteErr && !userMissingInAuth) {
    return NextResponse.json({ error: authDeleteMsg || "Failed to delete auth user." }, { status: 500 });
  }

  const { error: profileDeleteErr } = await admin.from("client_users").delete().eq("user_id", userId);
  if (profileDeleteErr && userMissingInAuth) {
    return NextResponse.json({ error: profileDeleteErr.message || "Failed to delete client profile." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
