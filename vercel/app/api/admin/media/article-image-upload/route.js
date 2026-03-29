import { NextResponse } from "next/server";
import { requireAdminApi } from "../../../../../lib/adminApi";
import { ensureSupabaseBucket, getObjectStorageProvider, resolveObjectUrl, uploadPublicObject } from "../../../../../lib/objectStorage";

export const runtime = "nodejs";

function safeName(name) {
  return String(name || "article-image")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_");
}

export async function POST(request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  try {
    const form = await request.formData();
    const file = form.get("file");
    const folder = String(form.get("folder") || "articles")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9/_-]+/g, "-");

    if (!file || typeof file !== "object" || !("arrayBuffer" in file)) {
      return NextResponse.json({ error: "Image file is required." }, { status: 400 });
    }

    const type = String(file.type || "");
    if (!type.startsWith("image/")) {
      return NextResponse.json({ error: "Only image files are allowed." }, { status: 400 });
    }
    if (Number(file.size || 0) > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "Image too large. Max 5MB." }, { status: 400 });
    }

    const bucket = process.env.ARTICLE_IMAGE_BUCKET || process.env.OBJECT_STORAGE_BUCKET_IMAGES || "article-images";
    if (getObjectStorageProvider() === "supabase") {
      await ensureSupabaseBucket(bucket, {
        fileSizeLimit: 5 * 1024 * 1024,
        allowedMimeTypes: ["image/png", "image/jpeg", "image/webp", "image/jpg"],
      });
    }
    const ext = safeName(file.name || "article-image.png").split(".").pop() || "png";
    const filePath = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const bytes = Buffer.from(await file.arrayBuffer());
    const uploaded = await uploadPublicObject({
      bucket,
      key: filePath,
      bytes,
      contentType: type,
    });

    const previewUrl = await resolveObjectUrl({
      bucket: uploaded.bucket,
      path: uploaded.path,
      fallbackUrl: uploaded.url,
    });

    return NextResponse.json({
      ok: true,
      url: uploaded.url,
      preview_url: previewUrl,
      path: uploaded.path,
      bucket: uploaded.bucket,
    });
  } catch (error) {
    return NextResponse.json({ error: error?.message || "Failed to upload article image." }, { status: 500 });
  }
}
