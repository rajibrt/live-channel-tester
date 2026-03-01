import { NextResponse } from "next/server";
import { requireClientApi } from "../../../../lib/clientApi";
import { formatSmtpError, loadEmailSettings, sendApprovalRequestAdminEmail } from "../../../../lib/emailDelivery";
import { getSupabaseAdmin } from "../../../../lib/supabaseAdmin";

function normalizeMobile(value) {
  const raw = String(value || "").trim();
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 11) return { raw, key: "" };
  return { raw, key: digits.slice(-11) };
}

function buildApprovalMessage({ fullName, email, mobile, requestedAt }) {
  return [
    "আসসালামু আলাইকুম,",
    "",
    "আমি WEBTVBD ওয়েবসাইট থেকে অ্যাকাউন্ট অনুমোদনের রিকোয়েস্ট করেছি।",
    `নাম: ${fullName || "-"}`,
    `ইমেইল: ${email || "-"}`,
    `মোবাইল: ${mobile || "-"}`,
    `রিকোয়েস্ট সময়: ${requestedAt}`,
    "",
    "চ্যানেল অ্যাক্সেসের জন্য আমার অ্যাকাউন্ট অনুমোদন করার অনুরোধ করছি।",
  ].join("\n");
}

export async function POST(request) {
  const auth = await requireClientApi();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const mobile = normalizeMobile(body?.mobile_number);
  if (!mobile.key) {
    return NextResponse.json({ error: "Please enter a valid mobile number (minimum 11 digits)." }, { status: 400 });
  }

  const current = auth.current;
  const approvalStatus = String(current?.client?.approval_status || "pending").toLowerCase();
  if (approvalStatus === "approved") {
    return NextResponse.json({ error: "Your profile is already approved." }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const nowIso = new Date().toISOString();
  const requestedAtText = new Date(nowIso).toLocaleString("en-US", { timeZone: "Asia/Dhaka" });
  const fullName = String(current?.client?.full_name || "").trim();
  const email = String(current?.client?.email || "").trim();
  const messageText = buildApprovalMessage({
    fullName,
    email,
    mobile: mobile.raw,
    requestedAt: requestedAtText,
  });

  const { error: updateErr } = await admin
    .from("client_users")
    .update({
      mobile_number: mobile.raw,
      mobile_login_key: mobile.key,
      updated_at: nowIso,
    })
    .eq("user_id", current.user.id);
  if (updateErr) {
    return NextResponse.json({ error: updateErr.message || "Failed to save mobile number." }, { status: 500 });
  }

  await admin.from("admin_notifications").insert({
    type: "client_approval_request",
    title: "Client submitted approval request",
    message: `${fullName || email} requested approval with mobile ${mobile.raw}.`,
    payload_json: {
      user_id: current.user.id,
      full_name: fullName,
      email,
      mobile_number: mobile.raw,
      via: "pending_card",
      requested_at: nowIso,
      message_text: messageText,
    },
  });

  await admin.from("client_activity_events").insert({
    user_id: current.user.id,
    event_type: "approval_request_submitted",
    event_data: {
      mobile_number: mobile.raw,
      requested_at: nowIso,
      via: "pending_card",
    },
  });

  let emailNotification = { sent: false, skipped: true, reason: "Not attempted." };
  try {
    const emailSettings = await loadEmailSettings(admin);
    emailNotification = await sendApprovalRequestAdminEmail({
      requestUser: {
        user_id: current.user.id,
        full_name: fullName,
        email,
        mobile_number: mobile.raw,
        auth_provider: current?.client?.auth_provider || "password",
        requested_at: nowIso,
      },
      settings: emailSettings,
    });
  } catch (err) {
    let settings = {};
    try {
      settings = await loadEmailSettings(admin);
    } catch {
      settings = {};
    }
    emailNotification = {
      sent: false,
      skipped: false,
      error: formatSmtpError(err, settings),
    };
  }

  return NextResponse.json({
    ok: true,
    messenger_url: "https://www.facebook.com/messages/t/WEBTVBD",
    message_text: messageText,
    email_notification: emailNotification,
  });
}
