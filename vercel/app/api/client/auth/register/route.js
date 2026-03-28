import { NextResponse } from "next/server";
import { createAdminNotification } from "../../../../../lib/adminNotifications";
import { loadEmailSettings, sendApprovalRequestAdminEmail, sendClientWelcomeEmail } from "../../../../../lib/emailDelivery";
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

function redirectRelative(path) {
  return new NextResponse(null, {
    status: 302,
    headers: { Location: path },
  });
}

export async function POST(request) {
  const form = await request.formData();
  const fullName = String(form.get("full_name") || "").trim();
  const email = normalizeEmail(form.get("email"));
  const mobile = normalizeMobile(form.get("mobile_number"));
  const password = String(form.get("password") || "");
  const confirmPassword = String(form.get("confirm_password") || "");
  const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  if (!fullName || !emailLooksValid || !mobile.key || password.length < 8) {
    return redirectRelative("/client-login?tab=signup&register_error=invalid");
  }

  if (password !== confirmPassword) {
    return redirectRelative("/client-login?tab=signup&register_error=password_mismatch");
  }

  const admin = getSupabaseAdmin();
  const now = new Date().toISOString();

  const { data: existingByMobile } = await admin
    .from("client_users")
    .select("user_id")
    .eq("mobile_login_key", mobile.key)
    .maybeSingle();

  if (existingByMobile?.user_id) {
    return redirectRelative("/client-login?tab=signup&register_error=mobile_exists");
  }

  const { data: existingByEmail } = await admin
    .from("client_users")
    .select("user_id")
    .eq("email", email)
    .maybeSingle();

  if (existingByEmail?.user_id) {
    return redirectRelative("/client-login?tab=signup&register_error=email_exists");
  }

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, signup_mobile: mobile.raw },
  });

  const userId = String(created?.user?.id || "").trim();
  if (createErr || !userId) {
    const lower = String(createErr?.message || "").toLowerCase();
    if (lower.includes("already")) {
      return redirectRelative("/client-login?tab=signup&register_error=email_exists");
    }
    return redirectRelative("/client-login?tab=signup&register_error=create_failed");
  }

  const { error: profileErr } = await admin.from("client_users").insert({
    user_id: userId,
    email,
    full_name: fullName,
    mobile_number: mobile.raw,
    mobile_login_key: mobile.key,
    approval_status: "approved",
    approved_at: now,
    approved_by_admin: null,
    approval_note: "",
    auth_provider: "self_register",
    provider_user_id: "",
    avatar_url: "",
    oauth_profile_json: {},
    lifetime_watch_count: 0,
    lifetime_watch_seconds: 0,
    last_watched_at: null,
    is_active: true,
    created_by_admin: null,
    created_at: now,
    updated_at: now,
  });

  if (profileErr) {
    await admin.auth.admin.deleteUser(userId, false).catch(() => {});
    return redirectRelative("/client-login?tab=signup&register_error=profile_failed");
  }

  await admin.from("client_state").upsert(
    {
      user_id: userId,
      favorites: [],
      recent: [],
      last_channel_id: "",
      theme: "dark",
      updated_at: now,
    },
    { onConflict: "user_id" }
  );

  await createAdminNotification({
    type: "client_self_signup",
    title: "New client self registration",
    message: `${fullName} created a client account with mobile ${mobile.raw}.`,
    payload: {
      user_id: userId,
      full_name: fullName,
      mobile_number: mobile.raw,
      auth_provider: "self_register",
      created_at: now,
    },
  }).catch(() => {});

  try {
    const settings = await loadEmailSettings(admin);
    await sendApprovalRequestAdminEmail({
      requestUser: {
        user_id: userId,
        full_name: fullName,
        email,
        mobile_number: mobile.raw,
        auth_provider: "self_register",
        requested_at: now,
      },
      settings,
      forceSend: true,
    });
  } catch {
    // best effort
  }

  try {
    const settings = await loadEmailSettings(admin);
    await sendClientWelcomeEmail({
      settings,
      forceSend: true,
      clientUser: {
        user_id: userId,
        email,
        full_name: fullName,
        mobile_number: mobile.raw,
        approval_status: "approved",
        approved_at: now,
        auth_provider: "self_register",
        created_at: now,
      },
    });
  } catch {
    // best effort
  }

  return redirectRelative("/client-login?registered=1");
}
