import { NextResponse } from "next/server";
import { requireAdminApi } from "../../../../../lib/adminApi";
import { buildTestEmail, formatSmtpError, loadEmailSettings, sendSmtpEmail } from "../../../../../lib/emailDelivery";

export async function POST(request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  try {
    const settings = await loadEmailSettings();
    const fallbackAdminMail = String(auth.current?.user?.email || "").trim().toLowerCase();
    const testPayload = buildTestEmail({
      settings,
      recipient: String(body?.recipient || "").trim() || settings.test_recipient || fallbackAdminMail,
    });

    if (!testPayload.to) {
      return NextResponse.json(
        { error: "Recipient is required. Add test recipient in settings or provide one before sending test." },
        { status: 400 }
      );
    }

    await sendSmtpEmail({
      settings,
      to: testPayload.to,
      subject: testPayload.subject,
      html: testPayload.html,
      text: testPayload.text,
      verify: true,
    });

    return NextResponse.json({ ok: true, to: testPayload.to });
  } catch (err) {
    let settings = {};
    try {
      settings = await loadEmailSettings();
    } catch {
      settings = {};
    }
    return NextResponse.json({ error: formatSmtpError(err, settings) }, { status: 500 });
  }
}
