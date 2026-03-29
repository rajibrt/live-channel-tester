import { NextResponse } from "next/server";
import { requireAdminApi } from "../../../../../lib/adminApi";
import { ensureSupabaseBucket, getObjectStorageProvider, uploadPublicObject } from "../../../../../lib/objectStorage";

export const runtime = "nodejs";

function safeName(name) {
  return String(name || "og-image")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_");
}

export async function POST(request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  try {
    const form = await request.formData();
    const file = form.get("file");

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

    const bucket = process.env.OG_IMAGE_BUCKET || process.env.OBJECT_STORAGE_BUCKET_IMAGES || "og-images";
    if (getObjectStorageProvider() === "supabase") {
      await ensureSupabaseBucket(bucket, {
        fileSizeLimit: 5 * 1024 * 1024,
        allowedMimeTypes: ["image/png", "image/jpeg", "image/webp", "image/jpg"],
      });
    }
    const ext = safeName(file.name || "og-image.png").split(".").pop() || "png";
    const filePath = `open-graph/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const bytes = Buffer.from(await file.arrayBuffer());
    const uploaded = await uploadPublicObject({
      bucket,
      key: filePath,
      bytes,
      contentType: type,
    });

    return NextResponse.json({ ok: true, url: uploaded.url, path: uploaded.path, bucket: uploaded.bucket });
  } catch (error) {
    return NextResponse.json({ error: error?.message || "Failed to upload Open Graph image." }, { status: 500 });
  }
}
