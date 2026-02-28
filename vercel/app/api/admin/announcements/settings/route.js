import { NextResponse } from "next/server";
import { requireAdminApi } from "../../../../../lib/adminApi";
import { getSupabaseAdmin } from "../../../../../lib/supabaseAdmin";

const SETTINGS_TABLE = "admin_settings";
const SETTINGS_KEY = "announcement_ticker";

function formatDbError(error, fallback) {
  const message = String(error?.message || fallback || "Request failed.");
  const code = String(error?.code || "");
  const lower = message.toLowerCase();
  if (code === "PGRST205" || code === "42P01" || lower.includes("schema cache") || lower.includes("does not exist")) {
    return "Settings module not initialized. Run latest SQL migration in Supabase.";
  }
  return message;
}

function normalizeSpeed(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 34;
  return Math.min(80, Math.max(1, Math.round(num)));
}

function normalizeIconText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 16);
}

function parseSettings(row) {
  const speed = normalizeSpeed(row?.value_json?.speed_seconds);
  const iconText = normalizeIconText(row?.value_json?.icon_text || "•");
  return { speed_seconds: speed, icon_text: iconText || "•" };
}

export async function GET() {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from(SETTINGS_TABLE)
    .select("value_json")
    .eq("key", SETTINGS_KEY)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: formatDbError(error, "Failed to load ticker speed.") }, { status: 500 });
  }

  return NextResponse.json(parseSettings(data));
}

export async function PATCH(request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const speed = normalizeSpeed(body?.speed_seconds);
  const iconText = normalizeIconText(body?.icon_text || "•") || "•";
  const admin = getSupabaseAdmin();
  const now = new Date().toISOString();

  const { error } = await admin
    .from(SETTINGS_TABLE)
    .upsert(
      {
        key: SETTINGS_KEY,
        value_json: { speed_seconds: speed, icon_text: iconText },
        updated_by_admin: auth.current.user.id,
        updated_at: now,
      },
      { onConflict: "key" }
    );

  if (error) {
    return NextResponse.json({ error: formatDbError(error, "Failed to save ticker speed.") }, { status: 500 });
  }

  return NextResponse.json({ ok: true, speed_seconds: speed, icon_text: iconText });
}
