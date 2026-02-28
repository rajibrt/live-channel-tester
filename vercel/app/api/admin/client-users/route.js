import { NextResponse } from "next/server";
import { requireAdminApi } from "../../../../lib/adminApi";
import { getSupabaseAdmin } from "../../../../lib/supabaseAdmin";

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeMobile(value) {
  const raw = String(value || "").trim();
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 11) return { raw, key: "" };
  return { raw, key: digits.slice(-11) };
}

export async function GET() {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("client_users")
    .select("user_id,email,full_name,mobile_number,mobile_login_key,is_active,approval_status,approval_note,auth_provider,provider_user_id,avatar_url,oauth_profile_json,lifetime_watch_count,lifetime_watch_seconds,last_watched_at,created_at,updated_at")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message || "Failed to load users" }, { status: 500 });
  return NextResponse.json({ items: data || [] });
}

export async function POST(request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const email = normalizeEmail(body?.email);
  const password = String(body?.password || "");
  const fullName = String(body?.full_name || "").trim();
  const mobile = normalizeMobile(body?.mobile_number);
  const mobileNumber = mobile.raw;
  const mobileLoginKey = mobile.key;

  if (!mobileLoginKey || !password || password.length < 8) {
    return NextResponse.json(
      { error: "Provide mobile number (minimum 11 digits) and password (minimum 8 characters)." },
      { status: 400 }
    );
  }

  const admin = getSupabaseAdmin();
  const now = new Date().toISOString();
  const loginEmail = email || `client_${mobileLoginKey}@streamtv.local`;

  if (email) {
    const { data: existingByEmail } = await admin
      .from("client_users")
      .select("user_id")
      .eq("email", email)
      .maybeSingle();
    if (existingByEmail) {
      return NextResponse.json(
        { error: "This email already exists in client user list." },
        { status: 409 }
      );
    }
  }

  const { data: existingByMobile } = await admin
    .from("client_users")
    .select("user_id,email,full_name,mobile_number,mobile_login_key,is_active,approval_status,approval_note,auth_provider,provider_user_id,avatar_url,oauth_profile_json,lifetime_watch_count,lifetime_watch_seconds,last_watched_at,created_at,updated_at")
    .eq("mobile_login_key", mobileLoginKey)
    .maybeSingle();

  if (existingByMobile) {
    return NextResponse.json(
      { error: "This mobile number is already used in client user list.", item: existingByMobile },
      { status: 409 }
    );
  }

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: loginEmail,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  let userId = created?.user?.id || "";
  if ((createErr || !userId) && String(createErr?.message || "").toLowerCase().includes("already")) {
    const { data: listed, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listErr) {
      return NextResponse.json(
        { error: "User already exists in auth, but failed to attach to client list." },
        { status: 400 }
      );
    }
    const matched = (listed?.users || []).find(
      (u) => String(u?.email || "").trim().toLowerCase() === loginEmail
    );
    if (!matched?.id) {
      return NextResponse.json(
        { error: "User exists in auth but could not be located. Please check auth users manually." },
        { status: 400 }
      );
    }
    userId = matched.id;
  } else if (createErr || !userId) {
    return NextResponse.json({ error: createErr?.message || "Failed to create auth user." }, { status: 400 });
  }

  const { error: profileErr } = await admin.from("client_users").upsert(
    {
      user_id: userId,
      email: loginEmail,
      full_name: fullName,
      mobile_number: mobileNumber,
      mobile_login_key: mobileLoginKey,
      approval_status: "approved",
      approved_at: now,
      approved_by_admin: auth.current.user.id,
      approval_note: "",
      auth_provider: "admin_created",
      provider_user_id: "",
      avatar_url: "",
      oauth_profile_json: {},
      lifetime_watch_count: 0,
      lifetime_watch_seconds: 0,
      last_watched_at: null,
      is_active: true,
      created_by_admin: auth.current.user.id,
      created_at: now,
      updated_at: now,
    },
    { onConflict: "user_id" }
  );

  if (profileErr) {
    return NextResponse.json({ error: profileErr.message || "Failed to create client profile." }, { status: 500 });
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

  return NextResponse.json({
    ok: true,
    item: {
      user_id: userId,
      email: loginEmail,
      full_name: fullName,
      mobile_number: mobileNumber,
      mobile_login_key: mobileLoginKey,
      is_active: true,
      approval_status: "approved",
      auth_provider: "admin_created",
      provider_user_id: "",
      avatar_url: "",
      oauth_profile_json: {},
      lifetime_watch_count: 0,
      lifetime_watch_seconds: 0,
      last_watched_at: null,
      created_at: now,
      updated_at: now,
    },
  });
}
