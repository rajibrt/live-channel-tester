import { NextResponse } from "next/server";
import { requireAdminApi } from "../../../../../lib/adminApi";
import { getSupabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { sendClientPush } from "../../../../../lib/clientPushNotifications";

const TABLE = "admin_announcements";

function formatDbError(error, fallback) {
  const message = String(error?.message || fallback || "Request failed.");
  const code = String(error?.code || "");
  const lower = message.toLowerCase();
  if (code === "PGRST205" || code === "42P01" || lower.includes("schema cache") || lower.includes("does not exist")) {
    return "Announcements database table এখনও initialize হয়নি। নিজের object bucket শুধু file upload-এর জন্য, article table create করে না। Supabase SQL Editor-এ `vercel/supabase/announcements.sql` রান করুন।";
  }
  return message;
}

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeContentType(value) {
  return String(value || "").trim().toLowerCase() === "announcement" ? "announcement" : "article";
}

function resolveContentType(row) {
  const ct = String(row?.content_type || "").trim().toLowerCase();
  if (ct === "announcement" || ct === "article") return ct;
  // Legacy installs without content_type column: use flags as heuristic
  return (row?.show_title_in_ticker || row?.is_pinned) ? "announcement" : "article";
}

function cleanUrl(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  return /^https?:\/\//i.test(text) ? text : "";
}

function stripHtml(html) {
  return String(html || "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(text, len = 180) {
  return String(text || "").slice(0, Math.max(1, Number(len || 180)));
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
    content_type: resolveContentType(row),
    featured_image_url: String(row?.featured_image_url || ""),
    featured_image_path: String(row?.featured_image_path || ""),
    featured_image_bucket: String(row?.featured_image_bucket || ""),
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
  let announcementTitle = "";
  let announcementBody = "";

  if (Object.prototype.hasOwnProperty.call(body, "title")) {
    const title = cleanText(body.title);
    if (title.length < 3) return NextResponse.json({ error: "Title must be at least 3 characters." }, { status: 400 });
    patch.title = title;
    announcementTitle = title;
  }

  if (Object.prototype.hasOwnProperty.call(body, "content_html")) {
    const contentHtml = String(body.content_html || "");
    const plain = stripHtml(contentHtml);
    if (!plain) return NextResponse.json({ error: "Article content is required." }, { status: 400 });
    patch.content_html = contentHtml;
    announcementBody = plain;
  }

  if (Object.prototype.hasOwnProperty.call(body, "featured_image_url")) {
    patch.featured_image_url = cleanUrl(body.featured_image_url);
  }

  if (Object.prototype.hasOwnProperty.call(body, "featured_image_path")) {
    patch.featured_image_path = cleanText(body.featured_image_path);
  }

  if (Object.prototype.hasOwnProperty.call(body, "featured_image_bucket")) {
    patch.featured_image_bucket = cleanText(body.featured_image_bucket);
  }

  if (Object.prototype.hasOwnProperty.call(body, "content_type")) {
    patch.content_type = normalizeContentType(body.content_type);
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
  let data;
  let error;
  ({ data, error } = await admin
    .from(TABLE)
    .update(patch)
    .eq("id", id)
    .select("id,title,content_html,content_type,featured_image_url,featured_image_path,featured_image_bucket,position,is_published,is_pinned,show_title_in_ticker,created_at,updated_at,published_at")
    .single());

  if (error) {
    const lower = String(error?.message || "").toLowerCase();
    const missingContentType = String(error?.code || "") === "42703" || lower.includes("content_type");
    if (missingContentType) {
      const { content_type, ...legacyPatch } = patch;
      ({ data, error } = await admin
        .from(TABLE)
        .update(legacyPatch)
        .eq("id", id)
        .select("id,title,content_html,featured_image_url,featured_image_path,featured_image_bucket,position,is_published,is_pinned,show_title_in_ticker,created_at,updated_at,published_at")
        .single());
    }
  }

  if (error) return NextResponse.json({ error: formatDbError(error, "Failed to update announcement.") }, { status: 500 });

  if (Object.prototype.hasOwnProperty.call(body, "is_published") && patch.is_published === true) {
    const title = announcementTitle || String(data?.title || "Announcement");
    const message = truncate(announcementBody || stripHtml(data?.content_html || ""), 180);
    await sendClientPush({
      title,
      message,
      payload: {
        kind: "announcement",
        announcement_id: String(data?.id || id),
        target_url: "/",
      },
    });
  }
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
