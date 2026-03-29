import { NextResponse } from "next/server";
import { requireAdminApi } from "../../../../lib/adminApi";
import { getSupabaseAdmin } from "../../../../lib/supabaseAdmin";
import { sendClientPush } from "../../../../lib/clientPushNotifications";

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

function normalizeContentType(value, fallback = "announcement") {
  return String(value || "").trim().toLowerCase() === "article" ? "article" : fallback;
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

function normalizePosition(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.floor(num));
}

function inferContentType(row) {
  return String(row?.featured_image_path || row?.featured_image_url || "").trim() ? "article" : "announcement";
}

function mapRow(row) {
  return {
    id: row?.id,
    title: String(row?.title || ""),
    content_html: String(row?.content_html || ""),
    content_type: normalizeContentType(row?.content_type, inferContentType(row)),
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

export async function GET() {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const admin = getSupabaseAdmin();
  const buildQuery = (selectClause) =>
    admin
      .from(TABLE)
      .select(selectClause)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });

  const { data, error } = await buildQuery(
    "id,title,content_html,content_type,featured_image_url,featured_image_path,featured_image_bucket,position,is_published,is_pinned,show_title_in_ticker,created_at,updated_at,published_at"
  );

  if (error) {
    const lower = String(error?.message || "").toLowerCase();
    const missingContentType = String(error?.code || "") === "42703" || lower.includes("content_type");
    if (!missingContentType) {
      return NextResponse.json({ error: formatDbError(error, "Failed to load announcements.") }, { status: 500 });
    }
    const fallback = await buildQuery(
      "id,title,content_html,featured_image_url,featured_image_path,featured_image_bucket,position,is_published,is_pinned,show_title_in_ticker,created_at,updated_at,published_at"
    );
    if (fallback.error) {
      return NextResponse.json({ error: formatDbError(fallback.error, "Failed to load announcements.") }, { status: 500 });
    }
    return NextResponse.json({ items: Array.isArray(fallback.data) ? fallback.data.map(mapRow) : [] });
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
  const contentType = normalizeContentType(body?.content_type, "announcement");
  const featuredImageUrl = cleanUrl(body?.featured_image_url);
  const featuredImagePath = cleanText(body?.featured_image_path);
  const featuredImageBucket = cleanText(body?.featured_image_bucket);

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

  const insertPayload = {
    title,
    content_html: contentHtml,
    content_type: contentType,
    featured_image_url: featuredImageUrl,
    featured_image_path: featuredImagePath,
    featured_image_bucket: featuredImageBucket,
    position: nextPosition,
    is_published: isPublished,
    is_pinned: isPinned,
    show_title_in_ticker: showTitleInTicker,
    published_at: isPublished ? now : null,
    created_by_admin: auth.current.user.id,
    updated_by_admin: auth.current.user.id,
    created_at: now,
    updated_at: now,
  };

  let data;
  let error;
  ({ data, error } = await adminClient
    .from(TABLE)
    .insert(insertPayload)
    .select("id,title,content_html,content_type,featured_image_url,featured_image_path,featured_image_bucket,position,is_published,is_pinned,show_title_in_ticker,created_at,updated_at,published_at")
    .single());

  if (error) {
    const lower = String(error?.message || "").toLowerCase();
    const missingContentType = String(error?.code || "") === "42703" || lower.includes("content_type");
    if (missingContentType) {
      const { content_type, ...legacyPayload } = insertPayload;
      ({ data, error } = await adminClient
        .from(TABLE)
        .insert(legacyPayload)
        .select("id,title,content_html,featured_image_url,featured_image_path,featured_image_bucket,position,is_published,is_pinned,show_title_in_ticker,created_at,updated_at,published_at")
        .single());
    }
  }

  if (error) {
    return NextResponse.json({ error: formatDbError(error, "Failed to create announcement.") }, { status: 500 });
  }

  if (isPublished) {
    await sendClientPush({
      title,
      message: plainContent.slice(0, 180),
      payload: {
        kind: "announcement",
        announcement_id: String(data?.id || ""),
        target_url: "/",
      },
    });
  }

  return NextResponse.json({ ok: true, item: mapRow(data) });
}
