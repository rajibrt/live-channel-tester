import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { CLIENT_SESSION_COOKIE } from "../../../../../../lib/clientAuth";
import { createAdminNotification } from "../../../../../../lib/adminNotifications";
import { getSupabaseAdmin, getSupabaseAnonConfig } from "../../../../../../lib/supabaseAdmin";
import { createSessionToken, SESSION_MAX_AGE } from "../../../../../../lib/sessionToken";

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeMobile(value) {
  const raw = String(value || "").trim();
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 11) return { raw, key: "" };
  return { raw, key: digits.slice(-11) };
}

function pickProviderUserId(user) {
  const identities = Array.isArray(user?.identities) ? user.identities : [];
  const fb = identities.find((item) => String(item?.provider || "").toLowerCase() === "facebook");
  const meta = user?.user_metadata || {};
  return String(
    fb?.identity_id ||
      fb?.id ||
      meta?.provider_id ||
      meta?.sub ||
      user?.id ||
      ""
  ).trim();
}

function pickAvatarUrl(user) {
  const meta = user?.user_metadata || {};
  return String(
    meta?.avatar_url ||
      meta?.picture ||
      meta?.profile_picture ||
      ""
  ).trim();
}

function pickFullName(user) {
  const meta = user?.user_metadata || {};
  return String(meta?.full_name || meta?.name || "").trim();
}

export async function GET(request) {
  const reqUrl = new URL(request.url);
  const code = String(reqUrl.searchParams.get("code") || "").trim();
  if (!code) {
    return NextResponse.redirect(new URL("/client-login?error=facebook_callback", request.url), { status: 302 });
  }

  try {
    const { url, anon } = getSupabaseAnonConfig();
    const auth = createClient(url, anon, { auth: { persistSession: false } });
    const { data, error } = await auth.auth.exchangeCodeForSession(code);
    if (error || !data?.user?.id) {
      return NextResponse.redirect(new URL("/client-login?error=facebook_callback", request.url), { status: 302 });
    }

    const user = data.user;
    const userId = String(user.id || "").trim();
    const providerUserId = pickProviderUserId(user);
    const fallbackEmail = `fb_${providerUserId || userId}@facebook.local`;
    const initialEmail = normalizeEmail(user.email) || fallbackEmail;
    const fullName = pickFullName(user);
    const avatarUrl = pickAvatarUrl(user);
    const meta = user?.user_metadata && typeof user.user_metadata === "object" ? user.user_metadata : {};
    const mobile = normalizeMobile(meta?.phone || meta?.phone_number || "");
    const now = new Date().toISOString();
    const admin = getSupabaseAdmin();

    const { data: existing } = await admin
      .from("client_users")
      .select("user_id,email,is_active,approval_status,approved_at,approved_by_admin,approval_note")
      .eq("user_id", userId)
      .maybeSingle();

    const nextApprovalStatus = String(existing?.approval_status || "pending").toLowerCase();
    const approvedAt = nextApprovalStatus === "approved" ? existing?.approved_at || now : null;
    const approvedByAdmin = nextApprovalStatus === "approved" ? existing?.approved_by_admin || null : null;
    let loginEmail = initialEmail;
    let upsertPayload = {
      user_id: userId,
      email: loginEmail,
      full_name: fullName,
      mobile_number: mobile.raw,
      mobile_login_key: mobile.key || null,
      approval_status: nextApprovalStatus,
      approved_at: approvedAt,
      approved_by_admin: approvedByAdmin,
      approval_note: String(existing?.approval_note || ""),
      auth_provider: "facebook",
      provider_user_id: providerUserId,
      avatar_url: avatarUrl,
      oauth_profile_json: meta,
      is_active: existing?.is_active !== false,
      updated_at: now,
    };
    if (!existing?.user_id) upsertPayload.created_at = now;

    let upsertRes = await admin.from("client_users").upsert(upsertPayload, { onConflict: "user_id" });
    if (upsertRes.error && String(upsertRes.error.message || "").toLowerCase().includes("client_users_email_key")) {
      loginEmail = fallbackEmail;
      upsertPayload = { ...upsertPayload, email: loginEmail };
      upsertRes = await admin.from("client_users").upsert(upsertPayload, { onConflict: "user_id" });
    }
    if (upsertRes.error) {
      return NextResponse.redirect(new URL("/client-login?error=facebook_profile", request.url), { status: 302 });
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

    const { data: profile } = await admin
      .from("client_users")
      .select("is_active,approval_status")
      .eq("user_id", userId)
      .single();

    const isActive = profile?.is_active !== false;
    const approvalStatus = String(profile?.approval_status || "pending").toLowerCase();

    await admin.from("client_activity_events").insert({
      user_id: userId,
      event_type: "client_login",
      event_data: { via: "facebook_oauth", approval_status: approvalStatus },
    });

    if (!existing?.user_id && approvalStatus !== "approved") {
      await createAdminNotification({
        type: "client_approval_pending",
        title: "New client approval pending",
        message: `${fullName || loginEmail} signed up with Facebook and is waiting for approval.`,
        payload: {
          user_id: userId,
          email: loginEmail,
          full_name: fullName,
          auth_provider: "facebook",
        },
      });
    }

    if (!isActive) {
      return NextResponse.redirect(new URL("/client-login?error=inactive", request.url), { status: 302 });
    }

    const redirectUrl = new URL(approvalStatus === "approved" ? "/" : "/?pending=1", request.url);
    const res = NextResponse.redirect(redirectUrl, { status: 302 });
    const sessionToken = createSessionToken({ sub: userId, typ: "client" }, SESSION_MAX_AGE);
    res.cookies.set(CLIENT_SESSION_COOKIE, sessionToken, {
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_MAX_AGE,
    });
    return res;
  } catch {
    return NextResponse.redirect(new URL("/client-login?error=facebook_callback", request.url), { status: 302 });
  }
}
