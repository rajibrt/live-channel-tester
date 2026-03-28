import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { getRequestBaseUrl } from "../../../../../lib/siteUrl";
import { loadEmailSettings, sendPasswordResetEmail } from "../../../../../lib/emailDelivery";

export async function POST(request) {
  const baseUrl = getRequestBaseUrl(request);
  const toRedirectUrl = (path) => new URL(path, `${baseUrl}/`);
  const form = await request.formData();
  const email = String(form.get("email") || "").trim().toLowerCase();
  const loginUrl = toRedirectUrl("/client-login?reset=sent");

  if (!email) {
    return NextResponse.redirect(toRedirectUrl("/client-login?reset=invalid"), { status: 302 });
  }

  try {
    const admin = getSupabaseAdmin();
    const settings = await loadEmailSettings(admin);
    const { data, error } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: {
        redirectTo: toRedirectUrl("/client-reset-password").toString(),
      },
    });
    if (error) throw error;
    const resetUrl = String(data?.properties?.action_link || "").trim();
    if (!resetUrl) throw new Error("Missing generated recovery link.");
    await sendPasswordResetEmail({
      settings,
      to: email,
      recipientName: data?.user?.user_metadata?.full_name || data?.user?.email || "",
      resetUrl,
      loginUrl: loginUrl.toString(),
      audience: "client",
    });
  } catch {
    // Keep response uniform so the endpoint does not reveal whether the email exists.
  }

  return NextResponse.redirect(loginUrl, { status: 302 });
}
