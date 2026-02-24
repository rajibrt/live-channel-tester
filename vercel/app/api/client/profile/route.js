import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireClientApi } from "../../../../lib/clientApi";
import { getSupabaseAdmin, getSupabaseAnonConfig } from "../../../../lib/supabaseAdmin";

export async function PATCH(request) {
  const auth = await requireClientApi();
  if (!auth.ok) return auth.response;

  const current = auth.current;
  const body = await request.json().catch(() => ({}));

  if (typeof body?.email !== "undefined" || typeof body?.mobile_number !== "undefined") {
    return NextResponse.json({ error: "Email and mobile number updates are not allowed currently." }, { status: 400 });
  }

  const fullName = typeof body?.full_name === "string" ? body.full_name.trim() : "";
  const newPassword = typeof body?.new_password === "string" ? body.new_password : "";
  const currentPassword = typeof body?.current_password === "string" ? body.current_password : "";

  if (!fullName && !newPassword) {
    return NextResponse.json({ error: "No changes provided." }, { status: 400 });
  }
  if (newPassword && newPassword.length < 8) {
    return NextResponse.json({ error: "New password must be at least 8 characters." }, { status: 400 });
  }
  if (newPassword && !currentPassword) {
    return NextResponse.json({ error: "Current password is required to change password." }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  if (newPassword) {
    const { url, anon } = getSupabaseAnonConfig();
    const authClient = createClient(url, anon, { auth: { persistSession: false } });
    const { error: verifyError } = await authClient.auth.signInWithPassword({
      email: String(current.client.email || ""),
      password: currentPassword,
    });
    if (verifyError) {
      return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });
    }

    const { error: pwError } = await admin.auth.admin.updateUserById(current.user.id, { password: newPassword });
    if (pwError) {
      return NextResponse.json({ error: pwError.message || "Failed to update password." }, { status: 500 });
    }
  }

  if (fullName) {
    const now = new Date().toISOString();
    const { error: profileError } = await admin
      .from("client_users")
      .update({ full_name: fullName, updated_at: now })
      .eq("user_id", current.user.id);
    if (profileError) {
      return NextResponse.json({ error: profileError.message || "Failed to update profile." }, { status: 500 });
    }
    await admin.auth.admin.updateUserById(current.user.id, { user_metadata: { full_name: fullName } });
  }

  await admin.from("client_activity_events").insert({
    user_id: current.user.id,
    event_type: "profile_update",
    event_data: { name_changed: Boolean(fullName), password_changed: Boolean(newPassword) },
  });

  return NextResponse.json({
    ok: true,
    item: {
      full_name: fullName || String(current.client.full_name || ""),
      email: String(current.client.email || ""),
      mobile_number: String(current.client.mobile_number || ""),
    },
  });
}
