import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../../lib/supabaseAdmin";

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

export async function GET() {
  const admin = getSupabaseAdmin();
  const settingsPromise = admin
    .from("admin_settings")
    .select("value_json")
    .eq("key", "announcement_ticker")
    .maybeSingle();
  const buildQuery = (selectClause) =>
    admin
      .from("admin_announcements")
      .select(selectClause)
      .eq("is_published", true)
      .order("position", { ascending: true })
      .order("updated_at", { ascending: false })
      .limit(20);

  let [{ data, error }, settingsRes] = await Promise.all([
    buildQuery("id,title,content_html,content_type,show_title_in_ticker,position,updated_at"),
    settingsPromise,
  ]);

  // Whether to use the strict content_type filter or the legacy fallback
  let legacySchema = false;

  if (error) {
    const lower = String(error?.message || "").toLowerCase();
    const missingContentType = String(error?.code || "") === "42703" || lower.includes("content_type");
    if (!missingContentType) {
      return NextResponse.json({ error: error.message || "Failed to load announcements." }, { status: 500 });
    }
    // content_type column doesn't exist yet — all rows in this table are legacy announcements
    legacySchema = true;
    ({ data, error } = await buildQuery("id,title,content_html,show_title_in_ticker,position,updated_at"));
    if (error) {
      return NextResponse.json({ error: error.message || "Failed to load announcements." }, { status: 500 });
    }
  }

  const rows = Array.isArray(data) ? data : [];
  // Announcements and articles are completely separate systems.
  // The ticker shows ONLY rows where content_type = 'announcement'.
  // If content_type column is absent (very old schema), all rows were announcements.
  const items = legacySchema
    ? rows
    : rows.filter((row) => String(row?.content_type || "").trim().toLowerCase() === "announcement");

  const speed = normalizeSpeed(settingsRes?.data?.value_json?.speed_seconds);
  const iconText = normalizeIconText(settingsRes?.data?.value_json?.icon_text || "•") || "•";
  return NextResponse.json({ items, speed_seconds: speed, icon_text: iconText });
}
