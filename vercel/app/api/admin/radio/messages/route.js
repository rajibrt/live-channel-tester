import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { requireAdminApi } from "../../../../../lib/adminApi";
import { getSupabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { RADIO_MESSAGES_KEY, cleanRadioMessages, loadRadioMessagesSetting } from "../../../../../lib/radioMessages";

export const dynamic = "force-dynamic";

// Settings + published notices the admin can pick from.
export async function GET() {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  const admin = getSupabaseAdmin();
  const settings = await loadRadioMessagesSetting(admin);
  const { data: notices } = await admin
    .from("admin_announcements")
    .select("id,title,content_type,is_published,published_at")
    .eq("is_published", true)
    .eq("content_type", "announcement")
    .order("published_at", { ascending: false })
    .limit(50);
  return NextResponse.json({ settings, notices: (notices || []).map((n) => ({ id: String(n.id), title: String(n.title || "").trim() })) });
}

export async function PUT(request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  const body = await request.json().catch(() => ({}));
  const value = cleanRadioMessages(body?.settings);
  const admin = getSupabaseAdmin();
  const { data: existing } = await admin.from("admin_settings").select("key").eq("key", RADIO_MESSAGES_KEY).maybeSingle();
  const { error } = existing
    ? await admin.from("admin_settings").update({ value_json: value }).eq("key", RADIO_MESSAGES_KEY)
    : await admin.from("admin_settings").insert({ key: RADIO_MESSAGES_KEY, value_json: value });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  try {
    revalidateTag("radio-messages", "max");
  } catch {
    // list also refreshes within 60 s
  }
  return NextResponse.json({ settings: value });
}
