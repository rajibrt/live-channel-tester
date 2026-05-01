import { NextResponse } from "next/server";
import { createAdminNotification } from "../../../../../lib/adminNotifications";
import {
  buildSignupSecurityMeta,
  checkSignupApprovalQueueLimit,
  checkSignupRateLimit,
  recordSignupSecurityEvent,
  verifyTurnstileToken,
} from "../../../../../lib/clientSignupProtection";
import { loadEmailSettings, sendApprovalRequestAdminEmail } from "../../../../../lib/emailDelivery";
import { loadClientAccessSettings } from "../../../../../lib/clientAccessSettings";
import { buildClientMetaFromRequest } from "../../../../../lib/requestClientMeta";
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
  const honeypot = String(form.get("signup_extra_check") || "").trim();
  const turnstileToken = String(form.get("cf-turnstile-response") || "").trim();
  const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const admin = getSupabaseAdmin();
  const requestMeta = buildClientMetaFromRequest(request);
  const securityMeta = buildSignupSecurityMeta(request, requestMeta);

  if (honeypot) {
    await recordSignupSecurityEvent(admin, securityMeta, {
      email,
      mobile_key: mobile.key,
      status: "blocked",
      reason: "honeypot",
    });
    return redirectRelative("/client-login?tab=signup&register_error=blocked");
  }

  const rateLimit = await checkSignupRateLimit(admin, securityMeta);
  if (!rateLimit.ok) {
    await recordSignupSecurityEvent(admin, securityMeta, {
      email,
      mobile_key: mobile.key,
      status: "blocked",
      reason: "rate_limited",
      details: { counts: rateLimit.counts, fallback: rateLimit.fallback },
    });
    return redirectRelative("/client-login?tab=signup&register_error=rate_limited");
  }

  const turnstile = await verifyTurnstileToken({ token: turnstileToken });
  if (!turnstile.ok) {
    await recordSignupSecurityEvent(admin, securityMeta, {
      email,
      mobile_key: mobile.key,
      status: "blocked",
      reason: "turnstile_failed",
      details: { error_code: turnstile.errorCode, skipped: turnstile.skipped },
    });
    return redirectRelative("/client-login?tab=signup&register_error=robot_check");
  }

  if (!fullName || !emailLooksValid || !mobile.key || password.length < 8) {
    await recordSignupSecurityEvent(admin, securityMeta, {
      email,
      mobile_key: mobile.key,
      status: "failed",
      reason: "invalid_input",
    });
    return redirectRelative("/client-login?tab=signup&register_error=invalid");
  }

  if (password !== confirmPassword) {
    await recordSignupSecurityEvent(admin, securityMeta, {
      email,
      mobile_key: mobile.key,
      status: "failed",
      reason: "password_mismatch",
    });
    return redirectRelative("/client-login?tab=signup&register_error=password_mismatch");
  }

  const now = new Date().toISOString();
  const accessSettings = await loadClientAccessSettings(admin).catch(() => null);
  const autoApprove = accessSettings?.self_registration_auto_approve === true;
  const approvalStatus = autoApprove ? "approved" : "pending";

  const { data: existingByMobile } = await admin
    .from("client_users")
    .select("user_id")
    .eq("mobile_login_key", mobile.key)
    .maybeSingle();

  if (existingByMobile?.user_id) {
    await recordSignupSecurityEvent(admin, securityMeta, {
      email,
      mobile_key: mobile.key,
      status: "failed",
      reason: "mobile_exists",
    });
    return redirectRelative("/client-login?tab=signup&register_error=mobile_exists");
  }

  const { data: existingByEmail } = await admin
    .from("client_users")
    .select("user_id")
    .eq("email", email)
    .maybeSingle();

  if (existingByEmail?.user_id) {
    await recordSignupSecurityEvent(admin, securityMeta, {
      email,
      mobile_key: mobile.key,
      status: "failed",
      reason: "email_exists",
    });
    return redirectRelative("/client-login?tab=signup&register_error=email_exists");
  }

  if (!autoApprove) {
    const approvalQueueLimit = await checkSignupApprovalQueueLimit(admin, securityMeta);
    if (!approvalQueueLimit.ok) {
      await recordSignupSecurityEvent(admin, securityMeta, {
        email,
        mobile_key: mobile.key,
        status: "blocked",
        reason: approvalQueueLimit.reason || "pending_capacity",
        details: { counts: approvalQueueLimit.counts, fallback: approvalQueueLimit.fallback },
      });
      return redirectRelative("/client-login?tab=signup&register_error=pending_limit");
    }
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
    await recordSignupSecurityEvent(admin, securityMeta, {
      email,
      mobile_key: mobile.key,
      status: "failed",
      reason: lower.includes("already") ? "email_exists" : "create_failed",
      details: { auth_error: String(createErr?.message || "").slice(0, 180) },
    });
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
    approval_status: approvalStatus,
    approved_at: autoApprove ? now : null,
    approved_by_admin: null,
    approval_note: autoApprove ? "Auto-approved by client access setting." : "",
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
    await recordSignupSecurityEvent(admin, securityMeta, {
      email,
      mobile_key: mobile.key,
      status: "failed",
      reason: "profile_failed",
      details: { profile_error: String(profileErr?.message || "").slice(0, 180) },
    });
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
    title: autoApprove ? "New client self registration auto-approved" : "New client self registration",
    message: autoApprove
      ? `${fullName} created a client account with mobile ${mobile.raw} and was auto-approved.`
      : `${fullName} created a client account with mobile ${mobile.raw}.`,
    payload: {
      user_id: userId,
      full_name: fullName,
      mobile_number: mobile.raw,
      auth_provider: "self_register",
      approval_status: approvalStatus,
      created_at: now,
      request_meta: requestMeta,
      security: {
        ip_hash: securityMeta.ip_hash,
        device_hash: securityMeta.device_hash,
        turnstile_skipped: turnstile.skipped,
      },
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
        approval_status: approvalStatus,
      },
      settings,
      forceSend: true,
    });
  } catch {
    // best effort
  }

  await recordSignupSecurityEvent(admin, securityMeta, {
    email,
    mobile_key: mobile.key,
    status: "succeeded",
    reason: autoApprove ? "auto_approved" : "pending_approval",
    details: { user_id: userId, turnstile_skipped: turnstile.skipped },
  });

  return redirectRelative(autoApprove ? "/client-login?registered=1&approved=1" : "/client-login?registered=1");
}
