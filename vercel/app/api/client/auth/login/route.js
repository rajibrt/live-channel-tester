import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { CLIENT_SESSION_COOKIE } from "../../../../../lib/clientAuth";
import { getSessionCookieDomain } from "../../../../../lib/cookieDomain";
import { buildClientMetaFromRequest } from "../../../../../lib/requestClientMeta";
import { getSupabaseAdmin, getSupabaseAnonConfig } from "../../../../../lib/supabaseAdmin";
import { createSessionToken, SESSION_MAX_AGE } from "../../../../../lib/sessionToken";

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeMobileKey(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length < 11) return "";
  return digits.slice(-11);
}

function redirectRelative(path) {
  return new NextResponse(null, {
    status: 302,
    headers: { Location: path },
  });
}

export async function POST(request) {
  const cookieDomain = getSessionCookieDomain();

  const form = await request.formData();
  const identifier = String(form.get("identifier") || "").trim();
  const password = String(form.get("password") || "");

  if (!identifier || !password) {
    return redirectRelative("/client-login?error=invalid");
  }

  const isEmailLogin = identifier.includes("@");
  const loginEmail = isEmailLogin ? normalizeEmail(identifier) : "";
  const loginMobileKey = isEmailLogin ? "" : normalizeMobileKey(identifier);
  if (!isEmailLogin && !loginMobileKey) {
    return redirectRelative("/client-login?error=invalid");
  }

  const admin = getSupabaseAdmin();
  let profileQuery = admin
    .from("client_users")
    .select("user_id,email,is_active,approval_status")
    .eq("is_active", true);
  profileQuery = isEmailLogin
    ? profileQuery.eq("email", loginEmail)
    : profileQuery.eq("mobile_login_key", loginMobileKey);
  const { data: profile } = await profileQuery.single();

  if (!profile) {
    return redirectRelative("/client-login?error=invalid");
  }

  const { url, anon } = getSupabaseAnonConfig();
  const auth = createClient(url, anon, { auth: { persistSession: false } });
  const { data, error } = await auth.auth.signInWithPassword({ email: profile.email, password });

  if (error || !data?.session?.access_token || !data?.user) {
    return redirectRelative("/client-login?error=invalid");
  }

  if (data.user.id !== profile.user_id) {
    return redirectRelative("/client-login?error=invalid");
  }

  const requestMeta = buildClientMetaFromRequest(request);

  await admin.from("client_activity_events").insert({
    user_id: data.user.id,
    event_type: "client_login",
    event_data: {
      via: isEmailLogin ? "email_password" : "mobile_password",
      approval_status: String(profile?.approval_status || "approved").toLowerCase(),
      ...requestMeta,
    },
  });

  const nextPath = String(profile?.approval_status || "").toLowerCase() === "approved" ? "/" : "/?pending=1";
  const res = redirectRelative(nextPath);
  const sessionToken = createSessionToken({ sub: data.user.id, typ: "client" }, SESSION_MAX_AGE);
  res.cookies.set(CLIENT_SESSION_COOKIE, sessionToken, {
    ...(cookieDomain ? { domain: cookieDomain } : {}),
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
