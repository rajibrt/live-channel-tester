import { NextResponse } from "next/server";
import { requireAdminApi } from "../../../../../lib/adminApi";
import { getSupabaseAdmin } from "../../../../../lib/supabaseAdmin";

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

export async function PATCH(request, { params }) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const id = String((await params)?.id || "").trim();
  if (!id) return NextResponse.json({ error: "Invalid id." }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const patch = {};

  if (Object.prototype.hasOwnProperty.call(body, "title")) {
    const title = cleanText(body.title);
    if (title.length < 3) return NextResponse.json({ error: "Title must be at least 3 characters." }, { status: 400 });
    patch.title = title;
  }

  if (Object.prototype.hasOwnProperty.call(body, "content_html")) {
    const contentHtml = String(body.content_html || "");
    if (!stripHtml(contentHtml)) return NextResponse.json({ error: "Article content is required." }, { status: 400 });
    patch.content_html = contentHtml;
  }

  if (Object.prototype.hasOwnProperty.call(body, "is_pinned")) {
    patch.is_pinned = !!body.is_pinned;
  }

  if (Object.prototype.hasOwnProperty.call(body, "show_title_in_ticker")) {
    patch.show_title_in_ticker = !!body.show_title_in_ticker;
  }

  if (Object.prototype.hasOwnProperty.call(body, "position")) {
    const nextPos = normalizePosition(body.position);
    if (nextPos <= 0) return NextResponse.json({ error: "Position must be 1 or greater." }, { status: 400 });
    patch.position = nextPos;
  }

  if (Object.prototype.hasOwnProperty.call(body, "is_published")) {
    const nextPublished = !!body.is_published;
    patch.is_published = nextPublished;
    patch.published_at = nextPublished ? new Date().toISOString() : null;
  }

  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: "No valid field to update." }, { status: 400 });
  }

  patch.updated_at = new Date().toISOString();
  patch.updated_by_admin = auth.current.user.id;

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from(TABLE)
    .update(patch)
    .eq("id", id)
    .select("id,title,content_html,position,is_published,is_pinned,show_title_in_ticker,created_at,updated_at,published_at")
    .single();

  if (error) return NextResponse.json({ error: formatDbError(error, "Failed to update announcement.") }, { status: 500 });
  return NextResponse.json({ ok: true, item: mapRow(data) });
}

export async function DELETE(_request, { params }) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const id = String((await params)?.id || "").trim();
  if (!id) return NextResponse.json({ error: "Invalid id." }, { status: 400 });

  const admin = getSupabaseAdmin();
  const { error } = await admin.from(TABLE).delete().eq("id", id);
  if (error) return NextResponse.json({ error: formatDbError(error, "Failed to delete announcement.") }, { status: 500 });
  return NextResponse.json({ ok: true });
}
