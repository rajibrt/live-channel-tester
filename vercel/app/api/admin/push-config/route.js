import { NextResponse } from "next/server";
import { requireAdminApi } from "../../../../lib/adminApi";

export async function GET() {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const publicKey = String(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.WEB_PUSH_VAPID_PUBLIC_KEY || ""
  ).trim();

  return NextResponse.json({
    configured: Boolean(publicKey),
    public_key: publicKey || null,
  });
}
