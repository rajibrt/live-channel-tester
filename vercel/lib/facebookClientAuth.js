import { createAdminNotification } from "./adminNotifications";
import { getSupabaseAdmin } from "./supabaseAdmin";

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

function pickFacebookProfileUrl(user, providerUserId) {
  const meta = user?.user_metadata || {};
  const directCandidates = [
    meta?.link,
    meta?.profile,
    meta?.profile_url,
    meta?.profile_link,
  ];
  for (const candidate of directCandidates) {
    const directUrl = String(candidate || "").trim();
    if (!directUrl || !/^https?:\/\//i.test(directUrl)) continue;
    try {
      const url = new URL(directUrl);
      if (/facebook\.com$/i.test(url.hostname) || /\.facebook\.com$/i.test(url.hostname)) {
        const firstSegment = String(url.pathname || "").replace(/^\/+/, "").split("/")[0] || "";
        const uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(firstSegment);
        if (!uuidLike) return url.toString();
      }
    } catch {
      // ignore malformed url
    }
  }

  const usernameCandidates = [
    meta?.user_name,
    meta?.username,
    meta?.preferred_username,
  ];
  for (const candidate of usernameCandidates) {
    const username = String(candidate || "").trim();
    if (/^[A-Za-z0-9.]{3,100}$/.test(username)) {
      return `https://www.facebook.com/${username}`;
    }
  }

  const id = String(providerUserId || "").trim();
  if (/^\d{5,30}$/.test(id)) {
    return `https://www.facebook.com/profile.php?id=${id}`;
  }

  return "";
}

export async function upsertFacebookClientLogin({ user, via = "facebook_oauth", requestMeta = {} }) {
  const userId = String(user?.id || "").trim();
  if (!userId) {
    return { ok: false, errorCode: "facebook_profile", errorMessage: "Missing user id." };
  }

  const providerUserId = pickProviderUserId(user);
  const fallbackEmail = `fb_${providerUserId || userId}@facebook.local`;
  const initialEmail = normalizeEmail(user?.email) || fallbackEmail;
  const fullName = pickFullName(user);
  const avatarUrl = pickAvatarUrl(user);
  const meta = user?.user_metadata && typeof user.user_metadata === "object" ? user.user_metadata : {};
  const profileUrl = pickFacebookProfileUrl(user, providerUserId);
  const oauthProfile = profileUrl ? { ...meta, profile_url: profileUrl } : meta;
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
    oauth_profile_json: oauthProfile,
    is_active: existing?.is_active !== false,
    updated_at: now,
  };
  if (!existing?.user_id) upsertPayload.created_at = now;

  let upsertRes = await admin
    .from("client_users")
    .upsert(upsertPayload, { onConflict: "user_id" })
    .select("is_active,approval_status")
    .single();
  if (upsertRes.error && String(upsertRes.error.message || "").toLowerCase().includes("client_users_email_key")) {
    loginEmail = fallbackEmail;
    upsertPayload = { ...upsertPayload, email: loginEmail };
    upsertRes = await admin
      .from("client_users")
      .upsert(upsertPayload, { onConflict: "user_id" })
      .select("is_active,approval_status")
      .single();
  }
  if (upsertRes.error && String(upsertRes.error.message || "").toLowerCase().includes("mobile_login_key")) {
    upsertPayload = {
      ...upsertPayload,
      mobile_number: "",
      mobile_login_key: null,
    };
    upsertRes = await admin
      .from("client_users")
      .upsert(upsertPayload, { onConflict: "user_id" })
      .select("is_active,approval_status")
      .single();
  }

  if (upsertRes.error) {
    return {
      ok: false,
      errorCode: "facebook_profile",
      errorMessage: upsertRes.error.message || "Failed to save profile.",
    };
  }

  if (!existing?.user_id) {
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
  }

  const profile = upsertRes.data || {};
  const isActive = profile?.is_active !== false;
  const approvalStatus = String(profile?.approval_status || "pending").toLowerCase();

  await admin.from("client_activity_events").insert({
    user_id: userId,
    event_type: "client_login",
    event_data: {
      via,
      approval_status: approvalStatus,
      ...requestMeta,
    },
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

  return {
    ok: true,
    userId,
    isActive,
    approvalStatus,
  };
}
