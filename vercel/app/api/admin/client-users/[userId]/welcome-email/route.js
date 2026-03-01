import { NextResponse } from "next/server";
import { requireAdminApi } from "../../../../../../lib/adminApi";
import { loadEmailSettings, sendClientWelcomeEmail } from "../../../../../../lib/emailDelivery";
import { getSupabaseAdmin } from "../../../../../../lib/supabaseAdmin";

export async function POST(_request, { params }) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const p = await params;
  const userId = String(p?.userId || "").trim();
  if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

  const admin = getSupabaseAdmin();
  const { data: user, error } = await admin
    .from("client_users")
    .select("user_id,email,full_name,mobile_number,is_active,approval_status,approved_at,auth_provider,created_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message || "Failed to load client user." }, { status: 500 });
  if (!user?.user_id) return NextResponse.json({ error: "Client user not found." }, { status: 404 });

  const approval = String(user?.approval_status || "approved").toLowerCase();
  if (approval !== "approved") {
    return NextResponse.json({ error: "Welcome email can be sent only for approved users." }, { status: 400 });
  }

  try {
    const settings = await loadEmailSettings(admin);
    const result = await sendClientWelcomeEmail({
      settings,
      forceSend: true,
      clientUser: user,
    });

    if (result?.sent) {
      return NextResponse.json({ ok: true, message: "Welcome email sent.", result });
    }

    return NextResponse.json(
      { error: result?.reason || "Welcome email was skipped.", result },
      { status: 400 }
    );
  } catch (err) {
    return NextResponse.json({ error: err?.message || "Failed to send welcome email." }, { status: 500 });
  }
}
