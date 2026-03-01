import { NextResponse } from "next/server";
import { requireAdminApi } from "../../../../../lib/adminApi";
import { getSupabaseAdmin } from "../../../../../lib/supabaseAdmin";
import {
  ADMIN_ROLE_SUPER,
  loadAdminRolesMap,
  normalizeAdminRole,
  readSuperAdminEmailsFromEnv,
  resolveAdminRole,
  saveAdminRolesMap,
} from "../../../../../lib/adminRoles";

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

export async function PATCH(request, { params }) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const p = await params;
  const userId = String(p?.userId || "").trim();
  if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const admin = getSupabaseAdmin();
  const rolesMap = await loadAdminRolesMap(admin);
  const superAdminEmails = readSuperAdminEmailsFromEnv();
  const currentAdminUserId = auth.current?.user?.id || "";

  const { data: existing, error: existingErr } = await admin
    .from("admin_users")
    .select("user_id,email,is_active")
    .eq("user_id", userId)
    .maybeSingle();
  if (existingErr) return NextResponse.json({ error: existingErr.message || "Failed to load admin." }, { status: 500 });
  if (!existing?.user_id) return NextResponse.json({ error: "Admin not found." }, { status: 404 });

  const currentRole = resolveAdminRole({
    userId: currentAdminUserId,
    email: auth.current?.user?.email || "",
    rolesMap,
    currentAdminUserId,
    superAdminEmails,
  });
  const targetRole = resolveAdminRole({
    userId,
    email: existing.email || "",
    rolesMap,
    currentAdminUserId,
    superAdminEmails,
  });

  const updates = {};
  const fullName = typeof body?.full_name === "string" ? String(body.full_name || "").trim() : null;
  const nextRoleInput = typeof body?.role === "string" ? normalizeAdminRole(body.role) : null;
  const nextRole = nextRoleInput || targetRole;
  const roleChanged = Boolean(nextRoleInput && nextRoleInput !== targetRole);

  if (roleChanged && currentRole !== ADMIN_ROLE_SUPER) {
    return NextResponse.json({ error: "Only super admin can change admin role." }, { status: 403 });
  }

  if (typeof body?.is_active === "boolean") {
    if (auth.current?.user?.id === userId && body.is_active === false) {
      return NextResponse.json({ error: "You cannot deactivate your own admin account." }, { status: 400 });
    }
    if (targetRole === ADMIN_ROLE_SUPER && body.is_active === false) {
      return NextResponse.json({ error: "Super admin cannot be deactivated from dashboard." }, { status: 400 });
    }
    updates.is_active = body.is_active;
  }

  if (typeof body?.email === "string") {
    const nextEmail = normalizeEmail(body.email);
    if (!nextEmail || !nextEmail.includes("@")) {
      return NextResponse.json({ error: "Valid email is required." }, { status: 400 });
    }
    const { error: authEmailErr } = await admin.auth.admin.updateUserById(userId, { email: nextEmail });
    if (authEmailErr) return NextResponse.json({ error: authEmailErr.message || "Failed to update auth email." }, { status: 400 });
    updates.email = nextEmail;
  }

  if (fullName !== null) {
    const { data: authUserRes, error: authUserErr } = await admin.auth.admin.getUserById(userId);
    if (authUserErr) return NextResponse.json({ error: authUserErr.message || "Failed to load auth user." }, { status: 500 });
    const prevMeta = authUserRes?.user?.user_metadata && typeof authUserRes.user.user_metadata === "object"
      ? authUserRes.user.user_metadata
      : {};
    const { error: nameErr } = await admin.auth.admin.updateUserById(userId, {
      user_metadata: { ...prevMeta, full_name: fullName },
    });
    if (nameErr) return NextResponse.json({ error: nameErr.message || "Failed to update full name." }, { status: 400 });
  }

  if (body?.new_password) {
    const pwd = String(body.new_password || "");
    if (pwd.length < 8) {
      return NextResponse.json({ error: "New password must be at least 8 characters." }, { status: 400 });
    }
    const { error: pwErr } = await admin.auth.admin.updateUserById(userId, { password: pwd });
    if (pwErr) return NextResponse.json({ error: pwErr.message || "Failed to update password." }, { status: 400 });
  }

  if (roleChanged) {
    const nextRolesMap = { ...rolesMap, [userId]: nextRole };
    const allRowsRes = await admin.from("admin_users").select("user_id,email");
    if (allRowsRes.error) {
      return NextResponse.json({ error: allRowsRes.error.message || "Failed to validate admin roles." }, { status: 500 });
    }
    const allRows = Array.isArray(allRowsRes?.data) ? allRowsRes.data : [];
    const superCount = allRows.filter((row) =>
      resolveAdminRole({
        userId: row.user_id,
        email: row.email,
        rolesMap: nextRolesMap,
        currentAdminUserId,
        superAdminEmails,
      }) === ADMIN_ROLE_SUPER
    ).length;
    if (superCount < 1) {
      return NextResponse.json({ error: "At least one super admin is required." }, { status: 400 });
    }
    await saveAdminRolesMap(admin, nextRolesMap, currentAdminUserId);
  }

  if (Object.keys(updates).length) {
    const { error: updateErr } = await admin.from("admin_users").update(updates).eq("user_id", userId);
    if (updateErr) return NextResponse.json({ error: updateErr.message || "Failed to update admin." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request, { params }) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const p = await params;
  const userId = String(p?.userId || "").trim();
  if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

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
    return NextResponse.json({ error: "Only super admin can delete admin accounts." }, { status: 403 });
  }
  if (userId === currentAdminUserId) {
    return NextResponse.json({ error: "You cannot delete your own admin account." }, { status: 400 });
  }

  const { data: existing, error: existingErr } = await admin
    .from("admin_users")
    .select("user_id,email,is_active")
    .eq("user_id", userId)
    .maybeSingle();
  if (existingErr) return NextResponse.json({ error: existingErr.message || "Failed to load admin." }, { status: 500 });
  if (!existing?.user_id) return NextResponse.json({ error: "Admin not found." }, { status: 404 });

  const targetRole = resolveAdminRole({
    userId,
    email: existing.email || "",
    rolesMap,
    currentAdminUserId,
    superAdminEmails,
  });
  if (targetRole === ADMIN_ROLE_SUPER) {
    return NextResponse.json({ error: "Super admin cannot be deleted from dashboard." }, { status: 400 });
  }
  if (existing.is_active !== false) {
    return NextResponse.json({ error: "Deactivate admin first, then delete." }, { status: 400 });
  }

  const { error: dbDeleteErr } = await admin.from("admin_users").delete().eq("user_id", userId);
  if (dbDeleteErr) {
    return NextResponse.json({ error: dbDeleteErr.message || "Failed to delete admin row." }, { status: 500 });
  }

  const { error: authDeleteErr } = await admin.auth.admin.deleteUser(userId);
  if (authDeleteErr && !String(authDeleteErr.message || "").toLowerCase().includes("not found")) {
    return NextResponse.json({ error: authDeleteErr.message || "Failed to delete auth user." }, { status: 500 });
  }

  if (Object.prototype.hasOwnProperty.call(rolesMap, userId)) {
    const nextRolesMap = { ...rolesMap };
    delete nextRolesMap[userId];
    await saveAdminRolesMap(admin, nextRolesMap, currentAdminUserId);
  }

  return NextResponse.json({ ok: true });
}
