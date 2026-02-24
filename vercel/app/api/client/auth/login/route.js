import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { CLIENT_SESSION_COOKIE } from "../../../../../lib/clientAuth";
import { getSupabaseAdmin, getSupabaseAnonConfig } from "../../../../../lib/supabaseAdmin";

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeMobileKey(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length < 11) return "";
  return digits.slice(-11);
}

export async function POST(request) {
  const form = await request.formData();
  const identifier = String(form.get("identifier") || "").trim();
  const password = String(form.get("password") || "");

  if (!identifier || !password) {
    return NextResponse.redirect(new URL("/client-login?error=missing", request.url), { status: 302 });
  }

  const isEmailLogin = identifier.includes("@");
  const loginEmail = isEmailLogin ? normalizeEmail(identifier) : "";
  const loginMobileKey = isEmailLogin ? "" : normalizeMobileKey(identifier);
  if (!isEmailLogin && !loginMobileKey) {
    return NextResponse.redirect(new URL("/client-login?error=invalid", request.url), { status: 302 });
  }

  const admin = getSupabaseAdmin();
  let profileQuery = admin
    .from("client_users")
    .select("user_id,email,is_active")
    .eq("is_active", true);
  profileQuery = isEmailLogin
    ? profileQuery.eq("email", loginEmail)
    : profileQuery.eq("mobile_login_key", loginMobileKey);
  const { data: profile } = await profileQuery.single();

  if (!profile) {
    return NextResponse.redirect(new URL("/client-login?error=invalid", request.url), { status: 302 });
  }

  const { url, anon } = getSupabaseAnonConfig();
  const auth = createClient(url, anon, { auth: { persistSession: false } });
  const { data, error } = await auth.auth.signInWithPassword({ email: profile.email, password });

  if (error || !data?.session?.access_token || !data?.user) {
    return NextResponse.redirect(new URL("/client-login?error=invalid", request.url), { status: 302 });
  }

  if (data.user.id !== profile.user_id) {
    return NextResponse.redirect(new URL("/client-login?error=invalid", request.url), { status: 302 });
  }

  await admin.from("client_activity_events").insert({
    user_id: data.user.id,
    event_type: "client_login",
    event_data: { via: isEmailLogin ? "email_password" : "mobile_password" },
  });

  const res = NextResponse.redirect(new URL("/", request.url), { status: 302 });
  res.cookies.set(CLIENT_SESSION_COOKIE, data.session.access_token, {
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 14,
  });
  return res;
}
