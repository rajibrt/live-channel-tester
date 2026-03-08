import { NextResponse } from "next/server";
import { requireAdminApi } from "../../../../../lib/adminApi";
import { getSupabaseAdmin } from "../../../../../lib/supabaseAdmin";

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

    const bucket = process.env.OG_IMAGE_BUCKET || process.env.LOGO_BUCKET || "logos";
    const supabase = getSupabaseAdmin();
    const ext = safeName(file.name || "og-image.png").split(".").pop() || "png";
    const filePath = `open-graph/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const bytes = Buffer.from(await file.arrayBuffer());

    const upload = await supabase.storage
      .from(bucket)
      .upload(filePath, bytes, { contentType: type, upsert: true });

    if (upload.error) {
      return NextResponse.json(
        { error: `Open Graph image upload failed: ${upload.error.message}. Ensure storage bucket "${bucket}" exists.` },
        { status: 500 }
      );
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
    const url = data?.publicUrl || "";
    if (!url) {
      return NextResponse.json({ error: "Upload succeeded but public URL not available." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, url, path: filePath, bucket });
  } catch (error) {
    return NextResponse.json({ error: error?.message || "Failed to upload Open Graph image." }, { status: 500 });
  }
}
