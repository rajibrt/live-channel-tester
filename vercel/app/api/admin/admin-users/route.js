import { NextResponse } from "next/server";
import { requireAdminApi } from "../../../../lib/adminApi";
import { getSupabaseAdmin } from "../../../../lib/supabaseAdmin";
import {
  ADMIN_ROLE_NORMAL,
  ADMIN_ROLE_SUPER,
  loadAdminRolesMap,
  normalizeAdminRole,
  readSuperAdminEmailsFromEnv,
  resolveAdminRole,
  saveAdminRolesMap,
} from "../../../../lib/adminRoles";

function pickFullName(user) {
  const meta = user?.user_metadata && typeof user.user_metadata === "object" ? user.user_metadata : {};
  return String(meta?.full_name || meta?.name || "").trim();
}

export async function GET() {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const admin = getSupabaseAdmin();
  const rolesMap = await loadAdminRolesMap(admin);
  const superAdminEmails = readSuperAdminEmailsFromEnv();
  const { data: rows, error } = await admin
    .from("admin_users")
    .select("user_id,email,is_active,created_at")
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message || "Failed to load admins." }, { status: 500 });
  }

  const { data: usersRes, error: usersErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (usersErr) {
    return NextResponse.json({ error: usersErr.message || "Failed to load auth users." }, { status: 500 });
  }
  const users = Array.isArray(usersRes?.users) ? usersRes.users : [];
  const byId = new Map(users.map((u) => [String(u.id || ""), u]));
  const currentAdminUserId = auth.current?.user?.id || "";

  const items = (rows || []).map((row) => {
    const userId = String(row.user_id || "");
    const authUser = byId.get(userId);
    const email = String(row.email || "").trim().toLowerCase();
    const role = resolveAdminRole({
      userId,
      email,
      rolesMap,
      currentAdminUserId,
      superAdminEmails,
    });
    return {
      user_id: userId,
      email,
      is_active: row.is_active !== false,
      created_at: row.created_at || null,
      role,
      full_name: pickFullName(authUser),
      email_confirmed_at: authUser?.email_confirmed_at || null,
      last_sign_in_at: authUser?.last_sign_in_at || null,
    };
  });

  const currentRole =
    items.find((x) => x.user_id === currentAdminUserId)?.role || ADMIN_ROLE_SUPER;

  return NextResponse.json({
    ok: true,
    current_admin_user_id: currentAdminUserId,
    current_admin_role: currentRole,
    items,
  });
}

export async function POST(request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const admin = getSupabaseAdmin();
  const rolesMap = await loadAdminRolesMap(admin);
  const superAdminEmails = readSuperAdminEmailsFromEnv();
  const currentAdminUserId = auth.current?.user?.id || "";
  const currentRole = resolveAdminRole({
    userId: currentAdminUserId,
    email: auth.current?.user?.email || "",
    rolesMap,
    currentAdminUserId,
    superAdminEmails,
  });
  if (currentRole !== ADMIN_ROLE_SUPER) {
    return NextResponse.json({ error: "Only super admin can create admin accounts." }, { status: 403 });
  }

  const email = String(body?.email || "").trim().toLowerCase();
  const password = String(body?.password || "");
  const fullName = String(body?.full_name || "").trim();
  const role = normalizeAdminRole(body?.role || ADMIN_ROLE_NORMAL);
  const isActive = body?.is_active === false ? false : true;

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email is required." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  const { data: createdRes, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: fullName ? { full_name: fullName } : {},
  });
  if (createErr || !createdRes?.user?.id) {
    return NextResponse.json({ error: createErr?.message || "Failed to create auth user." }, { status: 400 });
  }

  const newUserId = String(createdRes.user.id || "");
  const { error: insertErr } = await admin
    .from("admin_users")
    .insert({ user_id: newUserId, email, is_active: isActive });

  if (insertErr) {
    await admin.auth.admin.deleteUser(newUserId);
    return NextResponse.json({ error: insertErr.message || "Failed to create admin profile." }, { status: 500 });
  }

  try {
    const nextRolesMap = { ...rolesMap };
    if (role === ADMIN_ROLE_SUPER) nextRolesMap[newUserId] = ADMIN_ROLE_SUPER;
    else if (Object.prototype.hasOwnProperty.call(nextRolesMap, newUserId)) delete nextRolesMap[newUserId];
    await saveAdminRolesMap(admin, nextRolesMap, currentAdminUserId);
  } catch (err) {
    await admin.from("admin_users").delete().eq("user_id", newUserId);
    await admin.auth.admin.deleteUser(newUserId);
    return NextResponse.json({ error: err?.message || "Failed to set admin role." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, user_id: newUserId });
}
