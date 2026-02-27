import { NextResponse } from "next/server";
import { requireAdminApi } from "../../../../lib/adminApi";
import { getSupabaseAdmin } from "../../../../lib/supabaseAdmin";

const TABLE = "admin_announcements";

function formatDbError(error, fallback) {
  const message = String(error?.message || fallback || "Request failed.");
  const code = String(error?.code || "");
  const lower = message.toLowerCase();
  if (code === "PGRST205" || code === "42P01" || lower.includes("schema cache") || lower.includes("does not exist")) {
    return "Announcements module এখনও initialize হয়নি। Supabase SQL Editor-এ `vercel/supabase/schema.sql` (বা `vercel/supabase/announcements.sql`) রান করুন।";
  }
  return message;
}

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function stripHtml(html) {
  return String(html || "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePosition(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.floor(num));
}

function mapRow(row) {
  return {
    id: row?.id,
    title: String(row?.title || ""),
    content_html: String(row?.content_html || ""),
    position: normalizePosition(row?.position),
    is_published: !!row?.is_published,
    is_pinned: !!row?.is_pinned,
    show_title_in_ticker: !!row?.show_title_in_ticker,
    created_at: String(row?.created_at || ""),
    updated_at: String(row?.updated_at || ""),
    published_at: String(row?.published_at || ""),
  };
}

export async function GET() {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from(TABLE)
    .select("id,title,content_html,position,is_published,is_pinned,show_title_in_ticker,created_at,updated_at,published_at")
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: formatDbError(error, "Failed to load announcements.") }, { status: 500 });
  }

  return NextResponse.json({ items: Array.isArray(data) ? data.map(mapRow) : [] });
}

export async function POST(request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const title = cleanText(body?.title);
  const contentHtml = String(body?.content_html || "");
  const plainContent = stripHtml(contentHtml);
  const isPublished = !!body?.is_published;
  const isPinned = !!body?.is_pinned;
  const showTitleInTicker = !!body?.show_title_in_ticker;

  if (title.length < 3) {
    return NextResponse.json({ error: "Title must be at least 3 characters." }, { status: 400 });
  }
  if (!plainContent) {
    return NextResponse.json({ error: "Article content is required." }, { status: 400 });
  }

  const now = new Date().toISOString();
  const adminClient = getSupabaseAdmin();
  const maxPositionRes = await adminClient
    .from(TABLE)
    .select("position")
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextPosition = normalizePosition(maxPositionRes?.data?.position) + 1;

  const { data, error } = await adminClient
    .from(TABLE)
    .insert({
      title,
      content_html: contentHtml,
      position: nextPosition,
      is_published: isPublished,
      is_pinned: isPinned,
      show_title_in_ticker: showTitleInTicker,
      published_at: isPublished ? now : null,
      created_by_admin: auth.current.user.id,
      updated_by_admin: auth.current.user.id,
      created_at: now,
      updated_at: now,
    })
    .select("id,title,content_html,position,is_published,is_pinned,show_title_in_ticker,created_at,updated_at,published_at")
    .single();

  if (error) {
    return NextResponse.json({ error: formatDbError(error, "Failed to create announcement.") }, { status: 500 });
  }

  return NextResponse.json({ ok: true, item: mapRow(data) });
}
